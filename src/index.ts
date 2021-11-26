#!/usr/bin/env node
/* eslint-disable no-console */

import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import os from 'os';
import { Client } from 'basic-ftp';

import { createFileHash, VALID_VIDEO_EXTENSIONS } from './utils';
import { spawn } from 'child_process';

const ENVFILE = '.env';

export interface HatchData {
  id: string;
  day: number;
  url: string;
  open: boolean;
}

export interface HatchObject {
  hatches: HatchData[];
}

export interface HSLConfig {
  PORT: string;
  FTP_SRV: string;
  FTP_USER: string;
  FTP_PASS: string;
  FTP_ROOTDIR: string;
}

const error = (message: string) => {
  console.log(message);
  process.exit(1);
};

const main = async () => {
  console.log('Starting HLS Transcode Server');
  console.log('Reading Config');

  if (!fs.existsSync(path.resolve(ENVFILE))) {
    error('ConfigFile not exists');
  }

  const config: HSLConfig = (dotenv.parse(
    fs.readFileSync(path.resolve(ENVFILE)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any) as HSLConfig;

  const srv = express();
  srv.use(express.json());
  srv.use(
    fileUpload({
      useTempFiles: true,
      tempFileDir: os.tmpdir(),
    }),
  );
  srv.use(cors());
  srv.set('views', `views`);
  srv.set('view engine', 'ejs');

  srv.listen(config.PORT, () => {
    console.log(`Server is listening on port ${config.PORT}`);
  });

  srv.get('/hook/:video/:day', async (req, res) => {
    try {
      const {
        params: { video, day },
      } = req;

      if (!day) {
        console.warn('Day not provided will just upload it');
      }

      const videoUploadDir = path.resolve('uploads', video);
      if (!fs.existsSync(videoUploadDir)) {
        return res.status(400).send({
          error: 'Video unknown',
        });
      }

      console.log(`i should upload this: ${videoUploadDir} for day: ${day}`);

      const ftpClient = new Client();
      await ftpClient.access({
        host: config.FTP_SRV,
        user: config.FTP_USER,
        password: config.FTP_PASS,
      });

      const hatchesTemp = `${os.tmpdir()}/h.json`;
      await ftpClient.downloadTo(hatchesTemp, 'hatches.json');

      let hatches: undefined | HatchObject;
      try {
        const jsonString = fs.readFileSync(hatchesTemp);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hatches = (JSON.parse(jsonString.toString()) as any) as HatchObject;
      } catch (e) {
        return res.status(500).send({
          error: 'Error on JSON Parsing',
        });
      }
      if (hatches) {
        //check if day is there;
        if (hatches.hatches.find((h) => h.day === parseInt(day, 10))) {
          const updatedHatches = hatches.hatches.map((h) => {
            if (h.day === parseInt(day, 10)) {
              return { ...h, id: video, url: `/${video}/playlist.m3u8` };
            }
            return h;
          });
          hatches = { hatches: updatedHatches };
        } else {
          //not there
          hatches.hatches.push({
            id: video,
            day: parseInt(day, 10),
            url: `/${video}/playlist.m3u8`,
            open: false,
          });
        }

        fs.writeFileSync(hatchesTemp, JSON.stringify(hatches));
        await ftpClient.uploadFrom(hatchesTemp, 'hatches.json');
      }

      const list = await ftpClient.list();
      const upload =
        list.find((f) => f.name === video) === undefined ? true : false;

      if (upload) {
        await ftpClient.ensureDir(video);
        await ftpClient.clearWorkingDir();
        await ftpClient.uploadDir(videoUploadDir);
      }

      return res.status(200).send({
        message: 'file should be ready',
      });
    } catch (e) {
      return res.status(500).send({
        error: e,
      });
    }
  });

  srv.get('/', (req: Request, res: Response) => {
    res.render('index.ejs');
  });

  srv.post('/', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.send({
        status: 'ok',
        message: 'Es wurde kein File ausgewählt',
      });
    }

    const { day } = req.body;
    if (!day) {
      return res.send({
        status: 'nok',
        message: 'Der Tag wurde nicht ausgefüllt',
      });
    }

    const { video } = req.files;
    if (!video) {
      return res.send({
        status: 'nok',
        message:
          'No input file received. Please send video file in video in application/form-data formatVideo Format is not supported',
      });
    }

    if (Array.isArray(video)) {
      return res.send({
        status: 'nok',
        message: 'Multiple Files were sent! Only one is allowed',
      });
    }

    const { name, mimetype } = video;

    const extension = mime.extension(mimetype);
    if (!extension || !VALID_VIDEO_EXTENSIONS.includes(extension)) {
      return res.send({
        status: 'nok',
        message: 'Video Format not supported',
      });
    }

    try {
      // generate the unique id for this video.
      const videoId = await createFileHash(video.tempFilePath);
      const videoUploadDir = path.resolve('uploads', videoId);
      if (fs.existsSync(videoUploadDir)) {
        return res.send({
          status: 'ok',
          message: 'Video wurde bereits transkodiert',
        });
      }
      fs.mkdirSync(videoUploadDir);
      const videoFilePath = path.resolve('uploads', `${videoId}.${extension}`);
      fs.copyFileSync(video.tempFilePath, videoFilePath);

      const createHLSVOD = spawn('bash', [
        'create-hls-vod.sh',
        videoId,
        extension,
        day,
      ]);
      createHLSVOD.stdout.on('data', (d) => console.log(`stdout info: ${d}`));
      createHLSVOD.stderr.on('data', (d) => console.log(`stderr error: ${d}`));
      createHLSVOD.on('error', (d) => console.log(`error: ${d}`));
      createHLSVOD.on('close', (code) =>
        console.log(`child process ended with code ${code}`),
      );

      return res.send({
        status: 'ok',
        message: `Video: ${name} wird transkodiert`,
      });
    } catch (e) {
      return res.status(500).send({
        status: 'nok',
        error: e,
      });
    }
  });
};

main().catch((e) => console.log(e.message));

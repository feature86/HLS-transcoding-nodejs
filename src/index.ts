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

import { createFileHash, VALID_VIDEO_EXTENSIONS } from './utils';
import { spawn } from 'child_process';

const ENVFILE = '.env';

export interface HSLConfig {
  PORT: string;
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
  srv.get('/', (req: Request, res: Response) => {
    res.json('Hello I am the HSL Api!!');
  });

  srv.listen(config.PORT, () => {
    console.log(`Server is listening on port ${config.PORT}`);
  });

  srv.get('/:video', async (req, res) => {
    try {
      const {
        params: { video },
      } = req;

      console.log('Checking');

      const videoUploadDir = path.resolve('uploads', video);
      if (!fs.existsSync(videoUploadDir)) {
        return res.status(400).send({
          error: 'Video unknown',
        });
      }

      return res.status(200).send();
    } catch (e) {
      return res.status(500).send({
        error: e,
      });
    }
  });

  srv.post('/transcode', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    const { video } = req.files;
    if (!video) {
      return res.send({
        error:
          'No input file received. Please send video file in video in application/form-data format.',
      });
    }

    if (Array.isArray(video)) {
      return res.status(400).send({
        error: 'Multiple Files were sent! Only one is allowed',
      });
    }

    const { name, mimetype } = video;

    const extension = mime.extension(mimetype);
    if (!extension || !VALID_VIDEO_EXTENSIONS.includes(extension)) {
      return res.status(400).send({
        error: 'Video Format is not supported',
      });
    }

    try {
      // generate the unique id for this video.
      const videoId = await createFileHash(video.tempFilePath);
      /**
       * Save the incoming file in uploads folder
       */
      const videoUploadDir = path.resolve('uploads', videoId);
      if (fs.existsSync(videoUploadDir)) {
        return res.status(200).send({
          msg:
            'transcoding for this file already started or maybe is already finished',
        });
      }
      fs.mkdirSync(videoUploadDir);
      const videoFilePath = path.resolve(
        'uploads',
        videoId,
        `${videoId}.${extension}`,
      );
      fs.copyFileSync(video.tempFilePath, videoFilePath);

      const createHLSVOD = spawn('bash', [
        'create-hls-vod.sh',
        videoId,
        extension,
      ]);
      createHLSVOD.stdout.on('data', (d) => console.log(`stdout info: ${d}`));
      createHLSVOD.stderr.on('data', (d) => console.log(`stderr error: ${d}`));
      createHLSVOD.on('error', (d) => console.log(`error: ${d}`));
      createHLSVOD.on('close', (code) =>
        console.log(`child process ended with code ${code}`),
      );

      return res.status(200).send({
        msg: `transcoding started for: ${name}`,
      });
    } catch (e) {
      return res.status(500).send({
        error: e,
      });
    }
  });
};

main().catch((e) => console.log(e.message));

import { createHash } from 'crypto';
import fs from 'fs';

export const createSha256Hash = (value: string): string => {
  const hash = createHash('sha256');
  const hashString = hash.update(value).digest().toString('hex');
  return hashString;
};

export const createFileHash = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exists');
      }
      let hashHex;
      const hash = createHash('sha256');
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (err) => {
        throw new Error(err.message);
      });
      fileStream.on('data', (chunk) => {
        hash.update(chunk);
      });

      fileStream.on('end', function () {
        resolve(hash.digest('hex'));
      });

      return hashHex;
    } catch (e) {
      reject(e);
    }
  });
};

export const VALID_VIDEO_EXTENSIONS = [
  // MP4
  'mp4',
  'm4a',
  'm4v',
  'f4v',
  'f4a',
  'm4b',
  'm4r',
  'f4b',
  'mov',
  // 3GP
  '3gp',
  '3gp2',
  '3g2',
  '3gpp',
  '3gpp2',
  // OGG
  'ogg',
  'oga',
  'ogv',
  'ogx',
  // WMV
  'wmv',
  'wma',
  'asf',
  // WEBM
  'webm',
  // FLV
  'flv',
  // AVI
  'avi',
  // Quicktime
  'qt',
  // HDV
  'hdv',
  // MXF
  'OP1a',
  'OP-Atom',
  // MPEG-TS
  'ts',
  'mts',
  'm2ts',
  // WAV
  'wav',
  // Misc
  'lxf',
  'gxf',
  'vob',
];

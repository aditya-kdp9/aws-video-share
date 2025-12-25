import  child_process from "node:child_process";

interface MetaData {
    width: number;
    height: number;
    fileSize: number;
}


export class VideoMetaData {

    constructor(private config : {
        mediaInfoCliPath: string,
    }) {
    }

    async formUrl(url: string): Promise<MetaData> {
      return new Promise((resolve, reject) => {
          child_process.exec(`${this.config.mediaInfoCliPath} --output=JSON '${url}'`, (e, data) => {
              if(e) reject(e);
              const payload = JSON.parse(data);
              resolve({
                  fileSize: parseInt(payload.media.track[0].FileSize!),
                  width: parseInt(payload.media.track[1].Width!),
                  height: parseInt(payload.media.track[1].Height!)
              })
          });
      });
    }
}
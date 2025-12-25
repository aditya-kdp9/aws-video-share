import { S3Handler } from "aws-lambda";
import { VideoDB } from "../entity/video";
import { S3EventListener as Env} from "../lib/lambdaEnv";
import { VideoMetaData } from "../lib/video-metaData"
import { S3 } from "../lib/s3";
import { VideoConverter } from "../lib/video-converter";

const env = process.env as Env;


const videoMetaData = new VideoMetaData({
    mediaInfoCliPath: env.MEDIA_INFO_CLI_PATH
});


const uploadBucket = new S3({
    bucketName: env.UPLOAD_BUCKET_NAME,
    region: env.UPLOAD_BUCKET_REGION,
})

export const handler: S3Handler = async (e) => {
    const videoDB = new VideoDB({
        region: env.VIDEO_TABLE_REGION,
        tableName: env.VIDEO_TABLE_NAME,
    });

  const id = e.Records[0].s3.object.key;
  videoDB.collectChanges({
      status: "UPLOADED"
  })


  const metaData = await videoMetaData.formUrl(await uploadBucket.getDownloadUrl({ key: id, expiresIn: 2 * 60 }));

    const videoConverter = new VideoConverter({
        endpoint: env.MEDIA_CONVERT_ENDPOINT,
        region: env.MEDIA_CONVERT_REGION,
        roleArn: env.MEDIA_CONVERT_ROLE_ARN,
        inputFile: `s3://${env.UPLOAD_BUCKET_NAME}/${id}`,
        outputFile: `s3://${env.MEDIA_CONVERT_OUTPUT_BUCKET}/${id}`,
        userMetadata: {
            id,
        },
    });

  if(metaData.width >= 1280) {
      videoConverter.addResolution({
          width: 1280,
          height: 780,
          bitRate: 500000,
          nameExtension: "_720p",
      });
      videoDB.addFiles({
          "720p": `https://${env.MEDIA_CONVERT_OUTPUT_BUCKET}.s3.amazonaws.com/${id}_720p.mp4`
      })
  }
    if(metaData.width >= 640) {
        videoConverter.addResolution({
            width: 640,
            height: 360,
            bitRate: 100000,
            nameExtension: "_360p",
        });
        videoDB.addFiles({
            "360p": `https://${env.MEDIA_CONVERT_OUTPUT_BUCKET}.s3.amazonaws.com/${id}_360p.mp4`,
        });
    } else {
        videoConverter.addResolution({
            width: metaData.width,
            height: metaData.height,
            bitRate: 100000,
            nameExtension: "_240p",
        });
        videoDB.addFiles({
            "240p": `https://${env.MEDIA_CONVERT_OUTPUT_BUCKET}.s3.amazonaws.com/${id}_240p.mp4`,
        });
    }

    await videoDB.update({
        id,
        attrs: videoDB.changes,
    });

    await videoConverter.convert();

};


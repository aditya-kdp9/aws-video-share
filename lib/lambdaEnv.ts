export type VideoCrudHandler = {
    VIDEO_TABLE_NAME: string,
    VIDEO_TABLE_REGION: string,
    UPLOAD_BUCKET_NAME: string,
    UPLOAD_BUCKET_REGION: string,
    OPENSEARCH_ENDPOINT: string;
    OPENSEARCH_REGION: string;
}

export type S3EventListener = {
    VIDEO_TABLE_NAME: string,
    VIDEO_TABLE_REGION: string,
    MEDIA_INFO_CLI_PATH: string,
    UPLOAD_BUCKET_NAME: string,
    UPLOAD_BUCKET_REGION: string,
    MEDIA_CONVERT_ROLE_ARN: string;
    MEDIA_CONVERT_REGION: string;
    MEDIA_CONVERT_ENDPOINT: string;
    MEDIA_CONVERT_OUTPUT_BUCKET: string;
};

export type MediaConvertEventHandler = {
    VIDEO_TABLE_NAME: string;
    VIDEO_TABLE_REGION: string;
    UPLOAD_BUCKET_NAME: string;
    UPLOAD_BUCKET_REGION: string;
    OPENSEARCH_ENDPOINT: string;
    OPENSEARCH_REGION: string;
};
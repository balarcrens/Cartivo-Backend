const ImageKit = require("imagekit");
require('dotenv').config({ quiet: true });

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function uploadToImageKit(file, folder = "/Cartivo", fileName = null) {
    try {
        let fileContent;
        let finalFileName = fileName || `${Date.now()}`;

        if (file && typeof file === 'object' && file.buffer) {
            fileContent = file.buffer;
            if (!fileName) {
                finalFileName = `${Date.now()}-${file.originalname || 'image'}`;
            }
        }
        else if (typeof file === 'string') {
            fileContent = file;
            if (!fileName) {
                finalFileName = `${Date.now()}-upload.png`;
            }
        } else {
            throw new Error("Invalid file format. Must be a buffer or a base64 string.");
        }

        const result = await imagekit.upload({
            file: fileContent,
            fileName: finalFileName,
            folder: folder,
            useUniqueFileName: true,
        });

        return result.url;
    } catch (error) {
    console.error(error);
        console.error("ImageKit Upload Error:", error);
        throw error;
    }
}

module.exports = { imagekit, uploadToImageKit };
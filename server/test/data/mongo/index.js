const dotenv = require('dotenv').config({ path: __dirname + '/../../../.env' });

async function clearCollection(collection, collectionName) {
    try {
        await collection.deleteMany({});
        console.log(collectionName + " cleared");
    }
    catch (err) {
        console.log(err);
    }
}

async function fillCollection(collection, collectionName, data) {
    for (let i = 0; i < data.length; i++) {
        let doc = new collection(data[i]);
        await doc.save();
    }
    console.log(collectionName + " filled");
}


const mongoose = require('mongoose');
(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_CONNECT, { useNewUrlParser: true });
        await resetMongo();
        await mongoose.connection.close();
        process.exit(0);
    } 
    catch (e) {
        console.error("Error during DB reset:", e);
        process.exit(1);
    }
})();



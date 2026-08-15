//import { createRequire } from 'module';
//const require = createRequire(import.meta.url);

const { MongoClient } = require("mongodb");

 
// Replace the following with your Atlas connection string                                                                                                                                        
const url = "mongodb+srv://dantaylor6248:2WgRJwAwscpdSGlK@clusterdan1.shx5t.mongodb.net/?retryWrites=true&w=majority&appName=ClusterDan1";
// Connect to your Atlas cluster
const client = new MongoClient(url);
async function run() {
    try {
        await client.connect();
        console.log("Successfully connected to Atlas");
    } catch (err) {
        console.log(err.stack);
    }
    finally {
        await client.close();
    }
}
// run().catch(console.dir);

// Provide the name of the database and collection you want to use.
const dbName = "sample_mflix";
const collectionName = "movies";

// Create references to the database and collection in order to run
// operations on them.
const database = client.db(dbName);
const collection = database.collection(collectionName);

  /*
  * *** FIND DOCUMENTS ***
  *
  * Now that we have data in Atlas, we can read it. To retrieve all of
  * the data in a collection, we call Find() with an empty filter.
  * The Builders class is very helpful when building complex
  * filters, and is used here to show its most basic use.
  */

const findQuery = { prepTimeInMinutes: { $lt: 45 } };

try {
  const cursor = collection.find(findQuery).sort({ title: 1 });
  cursor.forEach(movies => {
    console.log(`${movies.title} is ${recipes.runtime} minutes long.`);
  });
  // add a linebreak
  console.log();
} catch (err) {
  console.error(`Something went wrong trying to find the documents: ${err}\n`);
}

// We can also find a single document. Let's find the first document
// that has the string "potato" in the ingredients list.
const findOneQuery = { title: "Ace" };

try {
  const findOneResult = collection.findOne(findOneQuery);
  if (findOneResult === null) {
    console.log("Couldn't find any movies that contain 'Act' in the title.\n");
  } else {
    console.log(`Found a movie with 'Ace' in the title:\n${JSON.stringify(findOneResult)}\n`);
  }
} catch (err) {
  console.error(`Something went wrong trying to find one document: ${err}\n`);
}

const mbutton = document.querySelector(".movie-button");

// Log when the button is clicked in the console.
mbutton.addEventListener("click", () => {
  mbutton.classList.toggle("active");
  console.log("Movie button was clicked!");
}, false);
  
run().catch(console.dir);
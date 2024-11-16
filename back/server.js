const express = require('express');
const app = express();
const cookieParser = require("cookie-parser");
const { MongoClient } = require('mongodb');
const mongoURI = "mongodb://localhost:27017";
const client = new MongoClient(mongoURI);
const { ObjectId } = require('mongodb');


let port=3010;

app.use(express.json());
app.use(cookieParser());
app.listen(port, () => {console.log(`listening on port ${port}`)});

app.get('/', async (request, response) => {
    response.send({'test': 0});
})

// USER AUTH SERVICE

app.post('/user/login', async (request, response) => {
    const submittedUsername = request.body.username;
    const submittedPassword = request.body.password;
    try {
        await client.connect();
        const user = await client.db('thedailybugle').collection('users').findOne({ username: submittedUsername });
        if (user && user.password === submittedPassword) {
            response.cookie('userId', user._id.toString());
            response.status(200).json({ message: 'auth success' });
        } else {
            response.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
    } finally {
        client.close();
    }
})

app.post('/user/logout', (request, response) => {
    response.clearCookie('userId');
    response.json({ message: 'Logged out' });
});

app.post('/user/checkAuthStatus', async (request, response) => {
    const { userId } = request.cookies;
    console.log(userId);
    try {
        if (userId) {
                await client.connect();
                const user = await client.db('thedailybugle').collection('users').findOne({ "_id": new ObjectId(userId)});
                if (user) {
                    response.json({ isLoggedIn: true, user: user });
                } else {
                    response.json({ isLoggedIn: false });
                }
        } else {
            response.json({ isLoggedIn: false });
        }
    } catch (error) {
        console.error(error);
    } finally {
        client.close();
    }
})

app.get('/story/featured', async (request, response) => {
    try {
        let featuredStories = []
        await client.connect();
        const cursor = await client.db('thedailybugle').collection('stories').find({}).limit(3);
        while (await cursor.hasNext()) {
            featuredStories.push(await cursor.next());
        }
        response.status(200).json(featuredStories);

    } catch (error) {
        console.error(error);
    } finally {
        client.close();
    }
})

app.get('/story/:id', async (request, response) => {
    const storyId = request.params.id;
    try {
        await client.connect();
        const story = await client.db('thedailybugle').collection('stories').findOne({ _id: new ObjectId(storyId) });
        if (story) {
            response.status(200).json(story);
        } else {
            response.status(404).json({ message: 'Story not found' });
        }
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred while retrieving the story' });
    } finally {
        client.close();
    }
});

app.get('/story', async (request, response) => {
    try {
        let values = []
        await client.connect();
        const cursor = await client.db('thedailybugle').collection('stories').find({});
        while (await cursor.hasNext()) { // wait for Mongo Service to return - returns a Promise Object
            values.push(await cursor.next());
        }
        
        response.status(200).json(values);
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred while retrieving the story' });
    } finally {
        client.close();
    }
});

app.post('/story', async (request, response) => {
    const { userId } = request.cookies;
    
    if (userId) {
        try {
            await client.connect();
            const author = await client.db('thedailybugle').collection('users').findOne({ "_id": new ObjectId(userId)}, { projection: { password: 0 } });
            if (author) {
                const { title, teaser, body, image, categories } = request.body;
                if (!title || !teaser || !body || !categories) {
                    return response.status(400).json({ message: 'Title, teaser, body, and categories are required.' });
                }

                const story = {
                    title: title,
                    teaser: teaser,
                    body: body,
                    image: image || '',
                    dateCreated: new Date(),
                    dateLastEdited: new Date(),
                    categories: categories,
                    author: author,
                    comments: []
                };
                
                const result = await client.db('thedailybugle').collection('stories').insertOne(story);
                response.status(200).json(result);
            } else {
                response.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            console.error(error);
            response.status(500).json({ message: 'An error occurred' });
        } finally {
            client.close();
        }

    } else {
        response.status(401).json({ message: 'Must be logged in to post a story' });
    }

})

app.put('/story', async (request, response) => {
    const { userId } = request.cookies;
    const storyId = request.body.storyId;
    try {
        await client.connect();
        if (userId && storyId) {
            const user = await client.db('thedailybugle').collection('users').findOne({ "_id": new ObjectId(userId)}, { projection: { password: 0 } });
            const story = await client.db('thedailybugle').collection('stories').findOne({ "_id": new ObjectId(storyId)});
            if(story && user) {
                if(story.author._id.equals(user._id)) {
                    
                    const { title, teaser, body, image, categories } = request.body;
                    if (!title || !teaser || !body || !categories || !image) {
                        return response.status(400).json({ message: 'Title, teaser, body, image, and categories are required.' });
                    }

                    const storyFilter = { "_id": new ObjectId(storyId)}
                    const updateDocument  = { $set: { 
                        "title": title,
                        "teaser": teaser,
                        "body": body,
                        "image": image,
                        "categories": categories,
                        "dateLastEdited": new Date()
                    }}
                    
                    const res = await client.db('thedailybugle').collection('stories').updateOne(storyFilter, updateDocument);
                    response.status(200).json(res);
                }
                else {
                    response.status(401).json({ message: 'Cannot edit this story' });
                }
            }
            else {
                response.status(404).json({ message: 'Not found' });
            }

        } else {
            response.status(401).json({ message: 'Must be logged in to edit a story' });
        }
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred' });
    } finally {
        client.close();
    }
})

// app.get('/comments/:storyId', async (request, response) => {

// })

app.post('/comments', async (request, response) => {
    const { userId } = request.cookies;
    const storyId = request.body.storyId;
    const commentText = request.body.commentText;

    try {
        await client.connect();
        if (userId && storyId) {
            const user = await client.db('thedailybugle').collection('users').findOne({ "_id": new ObjectId(userId)}, { projection: { password: 0 } });
            const story = await client.db('thedailybugle').collection('stories').findOne({ "_id": new ObjectId(storyId)});

            if(story && user) {
                
                const result = client.db('thedailybugle').collection('stories').updateOne({ _id: new ObjectId(storyId) }, { $push: { 
                    comments: {userId: user._id, username: user.username, dateCreated: new Date(), commentText: commentText}
                }})
                response.status(200).json(result);
            }
            else {
                response.status(404).json({ message: 'Not found' });
            }
        } else {
            response.status(401).json({ message: 'Must be logged in to comment' });
        }
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred' });
    } finally {
        client.close();
    }
    
})

app.get('/story/search/:query', async (request, response) => {
    const query = request.params.query;

    try {
        let values = [];
        await client.connect();
        const cursor = await client.db('thedailybugle').collection('stories').find({$text: { $search: query}});
        while (await cursor.hasNext()) { // wait for Mongo Service to return - returns a Promise Object
            values.push(await cursor.next());
        }
        response.status(200).json(values);
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred' });
    } finally {
        client.close();
    }
})

app.post('/ad/impression', async (request, response) => {
    const { userId } = request.cookies;
    const { actionType, pageId, adId } = request.body;
    const userAgent = request.headers['user-agent'];
    const ipAddress = request.ip || request.headers['x-forwarded-for'];
    
    const adImprrssion = {
        actionType,
        userId: userId || 'anonymous',
        pageId,
        adId,
        userAgent,
        ipAddress,
        dateCreated: new Date()
    }

    console.log(adImprrssion)

    try {
        await client.connect();
        const result = await client.db('thedailybugle').collection('adImpressions').insertOne(adImprrssion);
        response.status(200).json({
            res: result,
            message: 'ad impression created'
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: 'An error occurred' });
    } finally {
        client.close();
    }

    
})
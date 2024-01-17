const express = require('express');
const leapcell = require('@leapcell/leapcell-js');
const showdown   = require('showdown');
const dayjs = require('dayjs');

const app = express();
app.set('views', './templates');
app.set('view engine', 'ejs');

const api = new leapcell.Leapcell({
    apiKey: process.env.LEAPCELL_API_KEY,
});

const resource = process.env.RESOURCE || "issac/flask-blog";
const tableId = process.env.TABLE_ID || "tbl1738878922167070720";
const author = process.env.AUTHOR || "Leapcell User";
const avatar = process.env.AVATAR || "https://leapcell.io/logo.png";

const table = api.repo(resource).table(tableId);


app.get('/', async (request, response) => {
    let res = [];
    try {
        res = await table.records.findMany();
    } catch (error) {
        console.log(error);
        res = [];
    }

    const posts = res.map((post) => {
        return {
            record_id: post.record_id,
            title: post.fields["title"],
            content: post.fields["content"],
            cover: post.fields["cover"][0] || "",
            category: post.fields["category"],
            create_time: dayjs.unix(post.create_time).format("MMMM DD, YYYY"),
            summary: post.fields["content"].substring(0, 200) + "...",

        };
    })

    const list_posts = posts.slice(0, posts.length)
    const params = {
        "author": author,
        "avatar": avatar,
        "posts": list_posts,
        category: null,
        query: null,
    }
    return response.render('index', params);
});

app.get('/category/:category', async (request, response) => {
    category = request.params.category;
    let res = [];
    try {
        res = await table.records.findMany({
            where: {
                "category": {
                    "contain": category
                }
            }
        });
    } catch (error) {
        console.log(error);
        res = [];
    }

    const posts = res.map((post) => {
        return {
            record_id: post.record_id,
            title: post.fields["title"],
            content: post.fields["content"],
            cover: post.fields["cover"][0] || "",
            category: post.fields["category"],
            create_time: dayjs.unix(post.create_time).format("MMMM DD, YYYY"),
            summary: post.fields["content"].substring(0, 200) + "...",

        };
    })
    const list_posts = posts.slice(0, posts.length);
    const params = {
        "author": author,
        "avatar": avatar,
        "posts": list_posts,
        category: category,
        query: null,
    }
    return response.render('index', params);
});

app.get('/search', async (request, response) => {
    query = request.query.query;
    let res = [];
    try {
        res = await table.records.search({
            query: query,
            search_fields: ["title", "content"],
        });
    } catch (error) {
        console.log(error);
        res = [];
    }

    const posts = res.map((post) => {
        return {
            record_id: post.record_id,
            title: post.fields["title"],
            content: post.fields["content"],
            cover: post.fields["cover"][0] || "",
            category: post.fields["category"],
            create_time: dayjs.unix(post.create_time).format("MMMM DD, YYYY"),
            summary: post.fields["content"].substring(0, 200) + "...",

        };
    })
    const list_posts = posts.slice(0, posts.length);
    const params = {
        "author": author,
        "avatar": avatar,
        "posts": list_posts,
        category: null,
        query: query,
    }
    return response.render('index', params);
});

app.get("/post/:post_id", async (request, response) => {
    const post_id = request.params.post_id;
    const res = await table.records.findById(post_id);
    converter = new showdown.Converter();
    const post = {
        record_id: res.record_id,
        title: res.fields["title"],
        category: res.fields["category"],
        create_time: dayjs.unix(res.create_time).format("MMMM DD, YYYY"),
        cover: res.fields["cover"][0] || "",
    };
    return response.render('post', {
        "author": author,
        "avatar": avatar,
        "post": post,
        "markdown_html": converter.makeHtml(res.fields["content"]),
        "category": res.fields["category"],
    });
});

app.get("/hello", (request, response) => {
    return response.send("Hello World");
});

app.listen(8080, () => {
    console.log('App is listening on port 8080');
});
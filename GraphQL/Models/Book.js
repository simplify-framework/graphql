'use strict';

const Author = require('./Author')


const AuthorType = require('./AuthorType')

module.exports.Book = (context)=> {
    return {
        title: "5966b2416e016724",
        author: Author(context),
        comments: [ "9ddaf7a9db23f699","aeefda72d30439d8","62b0c542595d380f" ],
        outofstock: true,
        types: [ AuthorType(context) ]
    }
}

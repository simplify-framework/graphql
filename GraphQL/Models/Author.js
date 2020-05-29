'use strict';


const AuthorType = require('./AuthorType')

module.exports.Author = (context)=> {
    return {
        id: "4e8bccd9-b929-4aa2-b5d0-7107febe62fa",
        name: "c1d9919667cf3281",
        type: AuthorType(context)
    }
}

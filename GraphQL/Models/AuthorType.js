'use strict';

module.exports.AuthorType = (context)=> { return [ "ROMAN", "SCIENTIST"  ][context.Index || 0] }

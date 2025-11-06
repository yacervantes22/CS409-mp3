/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    require('./home.js')(router);
    require('./tasks.js')(router);
    require('./users.js')(router);
    app.use('/api', router);

    // app.use('/api', require('./home.js')(router));
    // app.use('/api', require('./tasks.js')(router));
    // app.use('/api', require('./users.js')(router));
};

#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
// var http    = require('http');
var request = require('request');
var cheerio = require('cheerio');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 9000;
        self.data = '';

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { './static/index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./static/index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('static/index.html') );
        };

        self.routes['/stops/*'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            stop_id = req.url.replace("/stops/","");
            self.parseBus(stop_id, res);
            // res.send(self.data);
            // console.log(req.url);
        };

        self.routes['/multistops/*'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            stops = req.url.replace("/multistops/","").split(",");
            console.log(stops);
            //self.parseBus(stop_id, res);
            for (i in stops) {
                console.log(stops[i]);
                self.parseBus(stops[i], self.data);
            }
            res.send(self.data);    

        };
    }

   // data = '';
    self.parseBus = function(stop_id, res) {
        var url = 'http://pugetsound.onebusaway.org/where/standard/stop.action?id=' + stop_id;
        var time;
        if (stop_id.match(/(\d+)_(\d+)/)) {

           time = new Date().toISOString().
              replace(/T/, ' ').      // replace T with a space
              replace(/\..+/, '')     // delete the dot and everything after

            console.log(time + " " + url);

            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    $ = cheerio.load(body);

                    var where_url = "http://pugetsound.onebusaway.org/where/standard/";
                    $("link[rel=stylesheet]").remove();
                    $("head").prepend('<link rel="stylesheet" href="../css/action.css">');

                    $("link[rel=icon]").remove();
                    //$("meta").remove();

                    $('a').each(function(i, link) {
                      if(!$(link).attr('href').match('^http')) {
                        newhref = where_url + $(link).attr('href').replace("/where/standard/","");
                        $(link).attr('href',newhref);
                      }
                    })

                    $("script, img, #header, #feedback, .agencyDisclaimers, .stop_links, .agenciesSection").remove();
                    res.send($.html());
               }
           });
        }
    }

    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();
        self.app.use(express.static('static'));

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();


var request = require('request'),
    cheerio = require('cheerio'),
    URL = require('url-parse'),
    json2csv = require('json2csv'),
    fs = require('file-system'),
    async = require('async');

var ARGS = process.argv,
    LIMIT = 5;

var asyncQueue = async.queue(function(task, callback) {
    var url = task.url;

    console.log('Visiting page:', url);

    request(url, function(error, response, body) {
        Crawlwer.dataToCsv.push({
            url: url,
            visited: true,
            status: response ? response.statusCode : 404
        });

        if (!response || response.statusCode !== 200) { // Check status code (200 is HTTP OK)
            return;
        }

        console.log('Status code:', response.statusCode);

        var $ = cheerio.load(body); // Parse the document body

        Crawlwer.collectInternalLinks($);
        callback();
    });
}, LIMIT);

var Crawlwer = {
    urlObj: '',
    pagesVisited: {},
    pagesToVisit: [],
    dataToCsv: [],

    collectInternalLinks: function($) {
        var urlObj = Crawlwer.urlObj,
            relativeLinks = $('a[href^="/"]') || [],
            absoluteLinks = $("a[href^='http']") || [],
            pagesVisited = Crawlwer.pagesVisited,
            count = 0,
            isPresent = 0;

        relativeLinks.each(function() {
            var url = urlObj.origin + $(this).attr('href');

            if (!(url in pagesVisited) && Crawlwer.pagesToVisit.indexOf(url) < 0) {
                count++;
                Crawlwer.pagesToVisit.push(url);
            }else {
                isPresent++;
            }
        });

        absoluteLinks.each(function() {
            var url = $(this).attr('href');

            if (url.indexOf(urlObj.hostname) >= 0 && !(url in pagesVisited) && Crawlwer.pagesToVisit.indexOf(url) < 0) {
                count++;
                Crawlwer.pagesToVisit.push(url);
            }else{
                isPresent++;
            }
        });

        if(isPresent){
            console.log('Found ', isPresent, ' internal links on page either to be visited or already visited')
        }

        if(count){
            console.log('Found ', count, ' internal links on page are to be visitd');
        }

        console.log('-----------------------------------------------------------------------------');
        Crawlwer.crawl();
    },

    visitPage: function(url) {
        Crawlwer.pagesVisited[url] = true; // Add page to our set
        asyncQueue.push({url: url});
    },

    crawl: function() {
        if (Crawlwer.pagesToVisit.length) { // New page we haven't visited
            var nextPage = Crawlwer.pagesToVisit.shift();
            Crawlwer.visitPage(nextPage);
            while (Crawlwer.pagesToVisit.length) {
                Crawlwer.crawl()
            }

        } else {
            return asyncQueue.drain = function() {
                var fields = ['url', 'visited', 'status'],
                    fileName = 'csv/' + (ARGS[3] ? ARGS[3] : 'asyncCrawler') + '.csv';

                json2csv({ data: Crawlwer.dataToCsv, fields: fields }, function(err, csv) {
                    if (err) console.error(err);
                    fs.writeFile(fileName, csv, function(err) {
                        if (err) throw err;
                        console.log('file saved');
                        return;
                    });
                });
            }
        }
    }
};

function startCrawler() {
    var urlObj = new URL(ARGS[2]);

    if (urlObj && urlObj.origin) {
        Crawlwer.urlObj = urlObj;
        Crawlwer.pagesToVisit = [urlObj.href];

        return Crawlwer.crawl();
    } else {
        console.error('Correct format: node crawler.js <http://www.example.com> <csv file name>');
        return;

    }
}

startCrawler();

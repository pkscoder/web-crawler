var request = require('request'),
    cheerio = require('cheerio'),
    URL = require('url-parse'),
    async = require('async'),
    csv = require('ya-csv'),
    bunyan = require("bunyan"),
    log = bunyan.createLogger({ name: 'asyncCrawler' });

var ARGS = process.argv,
    LIMIT = 5;

var asyncQueue = async.queue(function(task, callback) {
    var url = task.url;

    log.info('Visiting page:', url);

    request(url, function(error, response, body) {
        var statusCode = response ? response.statusCode : 404;

        Crawler.saveToCsv([url, (statusCode === 200), statusCode]);

        if (statusCode !== 200) { // Check status code (200 is HTTP OK)
            return;
        }

        log.info('Status code:', statusCode);

        var $ = cheerio.load(body); // Parse the document body

        Crawler.collectInternalLinks($);
        callback();
    });
}, LIMIT);

var Crawler = {
    urlObj: '',
    fileName: '',
    pagesVisited: {},
    pagesToVisit: [],

    saveToCsv: function(data) {
        var csvFile = csv.createCsvFileWriter(Crawler.fileName, { 'flags': 'a' });
        csvFile.writeRecord(data);
    },

    collectInternalLinks: function($) {
        var urlObj = Crawler.urlObj,
            relativeLinks = $('a[href^="/"]') || [],
            absoluteLinks = $("a[href^='http']") || [],
            pagesVisited = Crawler.pagesVisited,
            count = 0,
            isPresent = 0;

        relativeLinks.each(function() {
            var url = urlObj.origin + $(this).attr('href');

            if (!(url in pagesVisited) && Crawler.pagesToVisit.indexOf(url) < 0) {
                count++;
                Crawler.pagesToVisit.push(url);
            } else {
                isPresent++;
            }
        });

        absoluteLinks.each(function() {
            var url = $(this).attr('href');

            if (url.indexOf(urlObj.hostname) >= 0 && !(url in pagesVisited) && Crawler.pagesToVisit.indexOf(url) < 0) {
                count++;
                Crawler.pagesToVisit.push(url);
            } else {
                isPresent++;
            }
        });

        if (isPresent) {
            log.info('Found ', isPresent, ' internal links on page either to be visited or already visited')
        }

        if (count) {
            log.info('Found ', count, ' internal links on page are to be visitd');
        }

        Crawler.crawl();
    },

    visitPage: function(url) {
        Crawler.pagesVisited[url] = true; // Add page to our set
        asyncQueue.push({ url: url });
    },

    crawl: function() {
        if (Crawler.pagesToVisit.length) { // New page we haven't visited
            var nextPage = Crawler.pagesToVisit.shift();
            Crawler.visitPage(nextPage);
            while (Crawler.pagesToVisit.length) {
                Crawler.crawl()
            }

        } else {
            return asyncQueue.drain = function() {
                log.info('Crawling completed');
                log.info('Data saved in---', Crawler.fileName);
                return;
            }
        }
    }
};

function startCrawler() {
    var urlObj = new URL(ARGS[2]);

    if (urlObj && urlObj.origin) {
        Crawler.urlObj = urlObj;
        Crawler.fileName = (ARGS[3] ? ARGS[3] : 'asyncCrawler') + '.csv';

        var csvFile = csv.createCsvFileWriter(Crawler.fileName),
            fields = ['url', 'visited', 'status'];

        csvFile.writeRecord(fields);

        Crawler.pagesToVisit = [urlObj.href];

        return Crawler.crawl();
    } else {
        console.log('Correct format: node asyncCrawler.js <http://www.example.com> <csv_file_name>');
        return;
    }
}

startCrawler();

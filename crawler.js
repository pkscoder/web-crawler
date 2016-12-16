var request = require('request'),
    cheerio = require('cheerio'),
    URL = require('url-parse'),
    csv = require('ya-csv');

var ARGS = process.argv,
    LIMIT = 5;

var Crawlwer = {
    urlObj: '',
    fileName: '',
    pagesVisited: {},
    pagesToVisit: [],
    counter: 0,

    saveToCsv: function(data) {
        var csvFile = csv.createCsvFileWriter(Crawlwer.fileName, { 'flags': 'a' });
        csvFile.writeRecord(data);
    },

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
            } else {
                isPresent++;
            }
        });

        absoluteLinks.each(function() {
            var url = $(this).attr('href');

            if (url.indexOf(urlObj.hostname) >= 0 && !(url in pagesVisited) && Crawlwer.pagesToVisit.indexOf(url) < 0) {
                count++;
                Crawlwer.pagesToVisit.push(url);
            } else {
                isPresent++;
            }
        });

        if (isPresent) {
            console.log('Found ', isPresent, ' internal links on page either to be visited or already visited')
        }

        if (count) {
            console.log('Found ', count, ' internal links on page are to be visitd');
        }

        console.log('-----------------------------------------------------------------------------');
        Crawlwer.crawl();
    },

    visitPage: function(url) {
        Crawlwer.pagesVisited[url] = true; // Add page to our set
        Crawlwer.counter++;

        console.log('Visiting page:', url);

        request(url, function(error, response, body) {
            Crawlwer.counter--;
            var statusCode = response ? response.statusCode : 404;

            Crawlwer.saveToCsv([url, (statusCode === 200), statusCode]);

            if (statusCode !== 200) { // Check status code (200 is HTTP OK)
                return;
            }

            console.log('Status code:', statusCode);

            var $ = cheerio.load(body); // Parse the document body

            Crawlwer.collectInternalLinks($);
        });
    },

    crawl: function() {
        if (Crawlwer.pagesToVisit.length) { // New page we haven't visited
            var nextPage = Crawlwer.pagesToVisit.shift();
            Crawlwer.visitPage(nextPage);
            while (Crawlwer.pagesToVisit.length && Crawlwer.counter < LIMIT) {
                Crawlwer.crawl()
            }

        } else if (!Crawlwer.counter) {
            console.log('Crawling completed');
            return;
        }
    }
};

function startCrawler() {
    var urlObj = new URL(ARGS[2]);

    if (urlObj && urlObj.origin) {
        Crawlwer.urlObj = urlObj;
        Crawlwer.fileName = 'csv/' + (ARGS[3] ? ARGS[3] : 'crawler') + '.csv';

        var csvFile = csv.createCsvFileWriter(Crawlwer.fileName),
            fields = ['url', 'visited', 'status'];

        csvFile.writeRecord(fields);

        Crawlwer.pagesToVisit = [urlObj.href];

        return Crawlwer.crawl();
    } else {
        console.error('Correct format: node crawler.js <http://www.example.com> <csv_file_name>');
        return;

    }
}

startCrawler();

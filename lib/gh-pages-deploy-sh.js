// LICENSE : MIT
"use strict";
// https://gist.github.com/domenic/ec8b0fc8ab45f39403dd
var shell = require('shelljs');
var ghParse = require('parse-github-url');
var Acho = require('acho');
var path = require("path");
var gitConfig = require("./git-config");
var Command = require("command-promise");
var acho = new Acho();
function remoteURLWithToken(token) {
    if (token == null) {
        return "https://github.com/" + getSlug() + ".git"
    }
    return "https://" + token + "@github.com/" + getSlug() + ".git"
}
function getSlug() {
    // Travis CI
    // http://docs.travis-ci.com/user/environment-variables/
    if (process.env.TRAVIS_REPO_SLUG) {
        return process.env.TRAVIS_REPO_SLUG;
    }
    try {
        var pkg = require(path.join(process.cwd(), "package.json"));
        var gh = ghParse(pkg.repository.url);
        if (gh.repopath) {
            return gh.repopath;
        }
    } catch (error) {
        console.error(error);
    }
    throw new Error("Not found git repository.url");
}
function isTRAVIS() {
    return process.env.CI === "true" || process.env.TRAVIS === "true";
}
function isNotDeploy() {
    // when pull-request
    if (process.env.TRAVIS_PULL_REQUEST && process.env.TRAVIS_PULL_REQUEST !== 'false') {
        return true;
    }

    return false;
}
function deploy(directory) {
    if (!isTRAVIS()) {
        throw new Error("gh-pages-deploy-sh is for Travis CI.");
    }
    if (isNotDeploy()) {
        console.log("Don't deploy if it is pull-request");
        return Promise.resolve();
    }
    var deployDir = directory || path.join(process.cwd(), ".");
    acho.info("deploy directory " + deployDir);
    var tmpDir = process.env.TMPDIR;
    return Command("cp -rf " + deployDir + " " + tmpDir)
        .then(function () {
            var workDir = path.join(tmpDir, path.basename(deployDir));
            acho.info("tmp directory " + workDir);
            return Command("cd " + workDir);
        }).then(function () {
            return Command("rm -f .gitignore");
        }).then(function () {
            return gitConfig.resolveGitName().then(function () {
                return gitConfig.resolveGitEmail()
            })
        }).then(function () {
            acho.info("git checkout -B gh-pages");
            return Command("git checkout -B gh-pages");
        }).then(function () {
            acho.info("git add && git commit");
            return Command("git add .").then(function () {
                return Command("git diff --quiet --exit-code --cached || git commit -m 'Update " + new Date().toISOString() + "'");
            });
        }).then(function () {
            acho.info("git push to gh-pages");
            var repositoryURL = remoteURLWithToken(process.env.GH_TOKEN);
            return Command("git push --force --quiet '" + repositoryURL + "' master:gh-pages > /dev/null 2>&1")
        }).then(function () {
            return Command("git checkout -");
        })
}

module.exports = deploy;

var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var assign = require("object-assign");
var CachingWriter = require('broccoli-caching-writer');
var postcss = require('postcss');
var CssSyntaxError = require('postcss/lib/css-syntax-error');

function PostcssCompiler (inputTrees, inputFile, outputFile, plugins, map) {
    if ( !(this instanceof PostcssCompiler) ) {
        return new PostcssCompiler(inputTrees, inputFile, outputFile, plugins, map);
    }

    if ( !Array.isArray(inputTrees) ) {
        throw new Error('Expected array for first argument - did you mean [tree] instead of tree?');
    }

    CachingWriter.call(this, inputTrees, inputFile);

    this.inputFile = inputFile;
    this.outputFile = outputFile;
    this.plugins = plugins || [];
    this.map = map || {};
    this.warningStream = process.stderr;
}

PostcssCompiler.prototype = Object.create(CachingWriter.prototype);
PostcssCompiler.prototype.constructor = PostcssCompiler;

PostcssCompiler.prototype.updateCache = function (includePaths, destDir) {
    var toFilePath = path.join(destDir, this.outputFile);
    var fromFilePath = path.join(includePaths[0], this.inputFile);

    if ( !this.plugins || this.plugins.length < 1 ) {
        throw new Error('You must provide at least 1 plugin in the plugin array');
    }

    var processor = postcss();
    var css = fs.readFileSync(fromFilePath, 'utf8');
    var options = {
        from: fromFilePath,
        to: toFilePath,
        map: this.map
    };

    this.plugins.forEach(function (plugin) {
        var pluginOptions = assign(options, plugin.options || {});
        processor.use(plugin.module(pluginOptions));
    });

    var warningStream = this.warningStream;

    return processor.process(css, options)
        .then(function (result) {
            result.warnings().forEach(function (warn) {
                warningStream.write(warn.toString());
            });

            mkdirp.sync(path.dirname(toFilePath));
            fs.writeFileSync(toFilePath, result.css);
        })
        .catch(function (error) {
            if ( 'CssSyntaxError' === error.name ) {
                error.message += "\n" + error.showSourceCode();
            }

            throw error;
        });
};

module.exports = PostcssCompiler;

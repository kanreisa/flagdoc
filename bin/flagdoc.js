#!/usr/bin/env node

/**
 * Module
**/
var flagdoc  = require('../');
var opt      = require('tav').set();
var fs       = require('fs');
var path     = require('path');
var util     = require('util');

/**
 * Info
**/
if ((!opt.scripts || !opt.output || !opt.readme) || opt.version) {
	
	var package = require('../package.json');
	
	util.puts(
		[package.name, 'version', package.version].join(' ') + ', Copyright (c) 2013, Yuki KAN and Contributors.',
		'  modules: ' + util.inspect(package.dependencies, false, null, true),
		package.description,
		'*CLI mode',
		'usage: flagdoc --readme=[readme.md] --scripts=[script[, script, ...]] --output=[directory]'
	);
	
	return process.exit(0);
}

/**
 * Input
**/
var scripts = opt.scripts.split(',');
scripts.forEach(function(script) {
	
	script = script.trim();
	
	if (fs.existsSync(script) === false) {
		util.error(new Error('script ' + script + ' is not exists!'));
		process.exit(0);
	}
});

if (fs.existsSync(opt.readme) === false) {
	util.error(new Error('readme ' + opt.readme + ' is not exists!'));
	process.exit(0);
}
var readme = fs.readFileSync(opt.readme, { encoding: 'utf8' });

var output = opt.output.trim();
if (fs.existsSync(output) === false) {
	util.error(new Error('output ' + output + ' is not exists!'));
	process.exit(0);
}

/**
 * Parser
**/
var parser = flagdoc.createParser();

scripts.forEach(function(script) {
	
	parser.push({
		name  : script,
		script: fs.readFileSync(script, { encoding: 'utf8' })
	})
});

util.log('output: ' + output);
parser.output({
		output          : output,
		readme          : readme,
		sourceLinkPrefix: opt['source-link-prefix'] || '',
		template        : opt.template || null,
	}, function(err) {
	
	if (err) {
		util.error(err);
	}
	
	util.log('done.');
});
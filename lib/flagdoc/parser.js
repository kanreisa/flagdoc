var fs       = require('fs');
var flagdoc  = require('../flagdoc');
var _        = require('underscore');
var marked   = require('marked');

/* expose */
var parser = exports;

/* regexp */
var regexProductName    = /\/\*!\n\ \*\ (.+)\n/;
var regexNoteBegin      = /^\/\*\?/;
var regexNoteEnd        = /\*\*\/$/;
var regexClass          = /^class ([a-zA-Z\.]*([A-Z][a-zA-Z]+))$/;
var regexConstructor    = /^((?:new ([a-zA-Z.]*\.?)|([a-zA-Z.]*\.?)create)([A-Z][a-zA-Z]+))\(([^)]*)\)$/;
var regexInstanceMethod = /^(([^#]+)#([^#]+))\(([^)]*)\) -> ([^)]+)$/;
var regexClassMethod    = /^(([a-zA-Z.]+)\.([^.]+))\(([^)]*)\) -> ([^)]+)$/;
var regexSplitArguments = /^([^\[\]]*)\[?,? ?([^\[\]]*)\]?$/;
var regexArgument       = /^([^ =]+)(?: \= )?([^=]*)?$/;
var regexArgumentInfo   = /^- ([^ ]+) \(([^)]+)\) . (.*)$/;

var Parser = exports.Parser = function Parser() {
	
	this.scripts = [];
};

exports.create = function createParser() {
	
	return new Parser();
};

Parser.prototype.push = function(script) {
	
	this.scripts.push(script);
	
	return this;
};

Parser.prototype.output = function(opt, callback) {
	
	var outputDir        = opt.output;
	var readme           = opt.readme;
	var template         = opt.template || __dirname + '/../../template/';
	var sourceLinkPrefix = opt.sourceLinkPrefix || '';
	
	var templateIndex = fs.readFileSync(template + 'index.html', { encoding: 'utf8' });
	var templatePage  = fs.readFileSync(template + 'page.html', { encoding: 'utf8' });
	
	var productName = '';
	
	var root = [];
	var dict = {};
	
	var current, currentKey;
	
	this.scripts.forEach(function(script) {
		
		if (script.script.match(regexProductName) !== null) {
			productName = script.script.match(regexProductName)[1];
		}
		
		var lines = script.script.split('\n');
		
		var ignore = true;
		
		lines.forEach(function(line, i) {
			
			line = line.trim();
			
			if (regexNoteBegin.test(line) === true) ignore = false;
			if (ignore === true) return;
			if (regexNoteEnd.test(line) === true) ignore = true;
			
			line = line.replace(/^\* {0,2}/, '').replace(/^\/\*\?/, '').replace(/\*+\/$/, '');
			
			// class
			if (line.match(regexClass) !== null) {
				currentKey  = line.match(regexClass)[1];
				
				current = dict[currentKey] = {
					key       : currentKey,
					//name      : line.match(regexClass)[2],
					type      : 'class',
					text      : '',
					children  : [],
					sourceName: script.name,
					sourceLine: i + 1
				};
				root.push(current);
				
				return;
			}
			
			// constructor
			if (line.match(regexConstructor) !== null) {
				currentKey    = line.match(regexConstructor)[1];
				var classKey  = (
					(line.match(regexConstructor)[2] || '') +
					(line.match(regexConstructor)[3] || '') +
					(line.match(regexConstructor)[4] || '')
				);
				
				var arg       = line.match(regexConstructor)[5];
				
				var argRequire   = arg.match(regexSplitArguments)[1];
				var argOptional  = arg.match(regexSplitArguments)[2];
				var args         = [];
				var argRequires  = !!argRequire ? argRequire.split(',') : [];
				var argOptionals = !!argOptional ? argOptional.split(',') : [];
				
				argRequires.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : true,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				argOptionals.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : false,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				var parent = root;
				
				for (var k in dict) {
					if (dict[k].type !== 'class' || dict[k].key !== classKey) {
						continue;
					}
					parent = dict[k];
					break;
				}
				
				var it = parent !== root && _.find(parent.children, function(a) { return a.type === 'constructor'; });
				if (it) {
					current = it;
					current.aliases.push(currentKey);
				} else {
					current = dict[currentKey] = {
						key       : currentKey,
						classKey  : parent.key,
						aliases   : [],
						arguments : args,
						returns   : [parent.key],
						type      : 'constructor',
						text      : '',
						sourceName: script.name,
						sourceLine: i + 1
					};
					(!!parent.children ? parent.children : parent).push(current);
				}
				
				return;
			}
			
			// instance method
			if (line.match(regexInstanceMethod) !== null) {
				currentKey = line.match(regexInstanceMethod)[1];
				var classKey = line.match(regexInstanceMethod)[2];
				var name     = line.match(regexInstanceMethod)[3];
				var arg      = line.match(regexInstanceMethod)[4];
				var ret      = line.match(regexInstanceMethod)[5];
				
				var argRequire   = arg.match(regexSplitArguments)[1];
				var argOptional  = arg.match(regexSplitArguments)[2];
				var args         = [];
				var argRequires  = !!argRequire ? argRequire.split(',') : [];
				var argOptionals = !!argOptional ? argOptional.split(',') : [];
				
				argRequires.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : true,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				argOptionals.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : false,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				var returns = _.invoke(ret.split('|'), 'trim');
				
				var parent = root;
				
				for (var k in dict) {
					if (dict[k].type !== 'class' || dict[k].key !== classKey) {
						continue;
					}
					parent = dict[k];
					break;
				}
				
				current = dict[currentKey] = {
					key       : currentKey,
					classKey  : parent.key,
					arguments : args,
					returns   : returns,
					type      : 'instance-method',
					text      : '',
					sourceName: script.name,
					sourceLine: i + 1
				};
				(!!parent.children ? parent.children : parent).push(current);
				
				return;
			}
			
			// class method
			if (line.match(regexClassMethod) !== null) {
				currentKey = line.match(regexClassMethod)[1];
				var classKey = line.match(regexClassMethod)[2];
				var name     = line.match(regexClassMethod)[3];
				var arg      = line.match(regexClassMethod)[4];
				var ret      = line.match(regexClassMethod)[5];
				
				var argRequire   = arg.match(regexSplitArguments)[1];
				var argOptional  = arg.match(regexSplitArguments)[2];
				var args         = [];
				var argRequires  = !!argRequire ? argRequire.split(',') : [];
				var argOptionals = !!argOptional ? argOptional.split(',') : [];
				
				argRequires.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : true,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				argOptionals.forEach(function(arg) {
					
					arg = arg.trim();
					
					args.push({
						isRequired  : false,
						number      : args.length,
						name        : arg.match(regexArgument)[1],
						defaultValue: arg.match(regexArgument)[2]
					});
				});
				
				var returns = _.invoke(ret.split('|'), 'trim');
				
				var parent = root;
				
				for (var k in dict) {
					if (dict[k].type !== 'class' || dict[k].key !== classKey) {
						continue;
					}
					parent = dict[k];
					break;
				}
				
				current = dict[currentKey] = {
					key       : currentKey,
					classKey  : parent.key,
					arguments : args,
					returns   : returns,
					type      : 'class-method',
					text      : '',
					sourceName: script.name,
					sourceLine: i + 1
				};
				(!!parent.children ? parent.children : parent).push(current);
				
				return;
			}
			
			// argument
			if (line.match(regexArgumentInfo) !== null) {
				var name = line.match(regexArgumentInfo)[1];
				var type = line.match(regexArgumentInfo)[2];
				var desc = line.match(regexArgumentInfo)[3];
				
				current.arguments.forEach(function(a) {
					
					if (a.name !== name) return;
					
					a.types       = _.invoke(type.split('|'), 'trim');
					a.description = desc || '';
				});
				
				return;
			}
			
			if (current && typeof current.text !== 'undefined') {
				current.text += line + '\n';
			}
		});
	});
	
	var getHref = function(a) {
		
		a = a.replace('#', '.prototype.');
		a = a + '.html';
		
		return a;
	};
	
	var getLabel = function(a) {
		
		var label = a.key;
		
		if (a.classKey) {
			label = label.replace(a.classKey, '');
			
			if (a.type === 'constructor') {
				label = label.match(/^.*(\.[^.]+)$/)[1];
			}
			
			label = label.replace('.', '');
		}
		
		return label;
	};
	
	var flaglize = function(a) {
		
		var str = a;
		
		for (var k in dict) {
			if (k !== a) continue;
			
			str = '<a href="' + getHref(a) + '">' + a + '</a>';
			
			break;
		}
		
		return str;
	};
	
	var htmlApiList = '';
	
	htmlApiList += '<ul class="api-list">';
	
	root.forEach(function(a) {
		
		htmlApiList += '<li class="type-' + a.type + '">' +
		               '<a href="' + getHref(a.key) + '" title="' + a.key + ' (' + a.type + ')">' +
		               getLabel(a) + '</a>';
		
		if (a.children) {
			htmlApiList += '<ul>';
			
			a.children.forEach(function(b) {
				
				htmlApiList += '<li class="type-' + b.type + '">' +
				               '<a href="' + getHref(b.key) + '" title="' + b.key + ' (' + b.type + ')">' +
				               getLabel(b) + '</a></li>';
			});
			
			htmlApiList += '</ul>';
		}
		
		htmlApiList += '</li>';
	});
	
	htmlApiList += '</ul>';
	
	templateIndex = templateIndex.replace(/\[\[product\]\]/g, productName);
	templateIndex = templateIndex.replace(/\{\{apiList\}\}/g, htmlApiList);
	templatePage  = templatePage.replace(/\[\[product\]\]/g, productName);
	templatePage  = templatePage.replace(/\{\{apiList\}\}/g, htmlApiList);
	
	//index
	var htmlTop = templateIndex;
	htmlTop = htmlTop.replace(/\[\[title\]\]/g, 'Top');
	htmlTop = htmlTop.replace(/\[\[type\]\]/g, '');
	htmlTop = htmlTop.replace(/\{\{readme\}\}/g, marked(readme) + '<hr><div class="classes"><h3>Classes</h3>' + htmlApiList + '</div>');
	fs.writeFileSync(outputDir + 'index.html', htmlTop, { encoding: 'utf8' });
	
	// page
	Object.keys(dict).forEach(function(k) {
		
		var a = dict[k];
		
		var htmlPage = templatePage;
		htmlPage = htmlPage.replace(/\[\[title\]\]/g, a.key);
		htmlPage = htmlPage.replace(/\[\[type\]\]/g, a.type);
		htmlPage = htmlPage.replace(/\[\[sourceName\]\]/g, a.sourceName);
		htmlPage = htmlPage.replace(/\[\[sourceLine\]\]/g, a.sourceLine);
		htmlPage = htmlPage.replace(/\[\[sourceLink\]\]/g, sourceLinkPrefix + a.sourceName + '#L' + a.sourceLine);
		
		if (a.type !== 'class') {
			var ebnf = '<span class="key">' + a.key + '</span>';
			var args = '';
			
			ebnf += '(<span class="arguments">';
			
			if (a.arguments) {
				var optCount = 0;
				
				a.arguments.forEach(function(arg, i) {
					
					if (arg.isRequired === false) {
						++optCount;
						ebnf += '[';
					}
					if (i !== 0) ebnf += ', ';
					
					ebnf += arg.name;
					
					if (arg.defaultValue) {
						ebnf += ' = ' + arg.defaultValue;
					}
					
					var types = '';
					
					if (arg.types) {
						arg.types.forEach(function(type, j) {
							
							if (j !== 0) types += '|';
							
							types += '<code class="object-' + type + '">' + flaglize(type) + '</code>';
						});
					} else {
						types = '?';
					}
					
					args += '<li><code class="argument-name">' + arg.name + '</code> (' + types + ') – ' + (arg.description || '') + '</li>';
				});
				
				for (var i = 0; i < optCount; i++) {
					ebnf += ']';
				}
			}
			
			ebnf += '</span>)';
			
			if (a.returns) {
				ebnf += ' &rarr; <span class="return">'
				
				a.returns.forEach(function(ret, i) {
					
					if (i !== 0) ebnf += ' | ';
					
					ebnf += '<span class="object-' + ret + '">' + flaglize(ret) + '</span>';
				});
				
				ebnf += '</span>';
			}
			
			if (a.aliases) {
				a.aliases.forEach(function(b) {
					ebnf += '\n<span class="alias">' + b + '</span>'
				});
			}
			
			htmlPage = htmlPage.replace(/\{\{ebnf\}\}/g, ebnf);
			htmlPage = htmlPage.replace(/\{\{arguments\}\}/g, args);
			
			htmlPage = htmlPage.replace(/\{\{description\}\}/g, marked(a.text));
		} else {
			htmlPage = htmlPage.replace(/\{\{ebnf\}\}/g, '');
			htmlPage = htmlPage.replace(/\{\{arguments\}\}/g, '');
			
			var constructor = '<ul class="api-list">';
			var c           = _.find(a.children, function(a) { return a.type === 'constructor'; });
			constructor += '<li class="type-constructor">' +
			               '<a href="' + getHref(c.key) + '" title="' + c.key + ' (' + c.type + ')">' + getLabel(c) + '</a>'
			               '</li>';
			constructor += '</ul>';
			
			var iMethods = '<ul class="api-list">';
			a.children.forEach(function(b, i) {
				
				if (b.type === 'instance-method') {
					iMethods += '<li class="type-' + b.type + '">' +
					           '<a href="' + getHref(b.key) + '" title="' + b.key + ' (' + b.type + ')">' +
					           getLabel(b) + '</a></li>';
				}
			});
			iMethods += '</ul>';
			
			var cMethods = '<ul class="api-list">';
			a.children.forEach(function(b, i) {
				
				if (b.type === 'class-method') {
					cMethods += '<li class="type-' + b.type + '">' +
					           '<a href="' + getHref(b.key) + '" title="' + b.key + ' (' + b.type + ')">' +
					           getLabel(b) + '</a></li>';
				}
			});
			cMethods += '</ul>';
			
			var html = '';
			html += marked(a.text);
			html += '<hr><div class="constructor">';
			html += '<h3>Constructor</h3>';
			html += constructor;
			html += '<div style="clear:both;"></div></div>';
			if (iMethods !== '<ul class="api-list"></ul>') {
				html += '<div class="instance-methods">';
				html += '<h3>Instance methods</h3>';
				html += iMethods;
				html += '<div style="clear:both;"></div></div>';
			}
			if (cMethods !== '<ul class="api-list"></ul>') {
				html += '<div class="class-methods">';
				html += '<h3>Class methods</h3>';
				html += cMethods;
				html += '</div>';
			}
			
			htmlPage = htmlPage.replace(/\{\{description\}\}/g, html);
		}
		
		fs.writeFileSync(outputDir + getHref(a.key), htmlPage, { encoding: 'utf8' });
	});
	
	//console.log(require('util').inspect(_.pluck(root[0].children, 'key'), { colors: true, depth: 1 }));
	//console.log(require('util').inspect( root, { colors: true, depth: 1 }));
	
	callback(null);
};
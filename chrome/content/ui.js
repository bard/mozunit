/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is MozUnit.
 *
 * The Initial Developer of the Original Code is
 * Massimiliano Mirra <bard [at] hyperstruct [dot] net>.
 * Portions created by the Initial Developer are Copyright (C) 2006-2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Massimiliano Mirra <bard [at] hyperstruct [dot] net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;


var loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
    .getService(Ci.mozIJSSubScriptLoader);

var mozunit = {};
Cu.import('resource://mozunit/test_case.jsm', mozunit);
Cu.import('resource://mozunit/assertions.jsm', mozunit);


/* UTILITIES */

function x() {
    var contextNode, path;
    if(arguments[0] instanceof XULElement) {
        contextNode = arguments[0];
        path = arguments[1];
    }
    else {
        path = arguments[0];
        contextNode = document;
    }

    function resolver(prefix) {
        switch(prefix) {
        case 'xul':
            return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
            break;
        case 'hy':
            return 'http://hyperstruct.net/';
            break;
        default:
            return null;
        }
	return null;
    }

    return document.evaluate(
        path, contextNode, resolver,
        XPathResult.ANY_UNORDERED_NODE_TYPE, null).
        singleNodeValue;
}

function _(idOrElement, subCriteria) {
    var element = (idOrElement instanceof XULElement) ?
        idOrElement : document.getElementById(idOrElement);

    if(subCriteria)
        if(typeof(subCriteria) == 'object') {
            for(var attributeName in subCriteria)
                return x(element, './/*[@' + attributeName + '=' +
                         '"' + subCriteria[attributeName] + '"]');
        } else
            return x(element, './/*[@role="' + subCriteria + '"]');
    return element;
}

function clone(blueprintName) {
    return _('blueprints', blueprintName)
        .cloneNode(true);
}

function pickFile(mode, startDir) {
    mode = 'mode' + (mode ? 
                     mode[0].toUpperCase() + mode.substr(1) :
                     'Open');
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    
    var picker = Components
        .classes["@mozilla.org/filepicker;1"]
        .createInstance(nsIFilePicker);
    picker.defaultExtension = 'js';

    picker.init(window, 'New test file', nsIFilePicker[mode]);
    picker.appendFilter('Javascript Files', '*.js');
    picker.appendFilters(nsIFilePicker.filterAll);
    if(startDir)
	picker.displayDirectory = startDir;
    var result = picker.show();
    if(result == nsIFilePicker.returnOK ||
       result == nsIFilePicker.returnReplace)
        return picker.file;
    return null;
}

function pickFileUrl(mode, startDir) {
    var file = pickFile(mode, startDir);
    if(file)
        return fileToFileUrl(file);
    return null;
}

function fileToFileUrl(file) {
    return Components
        .classes['@mozilla.org/network/io-service;1']
        .getService(Components.interfaces.nsIIOService)
        .getProtocolHandler('file')
        .QueryInterface(Components.interfaces.nsIFileProtocolHandler)
        .getURLSpecFromFile(file); 
}

function fileUrlToFile(fileUrl) {
    return Components
	.classes['@mozilla.org/network/io-service;1'] 
	.getService(Components.interfaces.nsIIOService)
	.getProtocolHandler('file')
	.QueryInterface(Components.interfaces.nsIFileProtocolHandler)
	.getFileFromURLSpec(fileUrl);
}

function fileUrlToPath(fileUrl) {
    return fileUrlToFile(fileUrl).path;
}

function removeChildrenOf(element) {
    while(element.lastChild)
        element.removeChild(element.lastChild);
}

function padLeft(thing, width, padder) {
    var paddedString = '';
    var string = thing.toString();
    return (string.length < width) ?
        (function() {
            for(var i=0, l=width-string.length; i<l; i++)
                paddedString += padder;
            return paddedString + string;
        })() :
        string;
}

/* DOMAIN */

function init() {
    
}

function finish() {
    
}

function writeTemplate(filePath) {
    var data =
        "var TestCase = mozunit.TestCase;\n\
var assert = mozunit.asserto;\n\
\n\
var tc = new TestCase('testcase description here');\n\n\
tc.tests = {\n\
    'First test is successful': function() {\n\
        assert.isTrue(true);\n\
    }\n\
}\n";

    var file = Components
        .classes["@mozilla.org/file/local;1"]
        .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(filePath);

    var foStream = Components
        .classes["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Components.interfaces.nsIFileOutputStream);

    foStream.init(file, 0x02 | 0x08 | 0x20, 0644, 0); // write, create, truncate
    foStream.write(data, data.length);
    foStream.close();
}

function newTestCase() {
    var url = pickFileUrl('save');
    if(url) {
         _('file').value = url;
         writeTemplate(fileUrlToPath(url));
         openInEditor(url, 4, 24);
    }
}

function openTestCase() {
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);
    try {
	var startDir = pref
	    .getComplexValue("extensions.mozunit.lastdir", 
			     Components.interfaces.nsILocalFile, {});
    } catch(e) {
	var startDir = null;
    }
    var url = pickFileUrl('', startDir);
    if(url) {
        _('file').value = url;
	var file = fileUrlToFile(url);
	pref.setComplexValue("extensions.mozunit.lastdir",
			     Components.interfaces.nsILocalFile,
			     file.parent);
    }
}

function getTestCaseReport(title) {
    return _('testcase-reports', {title: title}) ||
        (function() {
            var wTestCaseReport = clone('testcase-report');
            wTestCaseReport.setAttribute('title', title);
            _(wTestCaseReport, 'title').value = title;
            _(wTestCaseReport, 'bar').setAttribute('class', 'testcase-fine');
            _('testcase-reports').appendChild(wTestCaseReport);
            return wTestCaseReport;
        })();
}

function testReportHandler(report) {
    var wTestCaseReport = getTestCaseReport(report.testOwner.title);
    _(wTestCaseReport, 'bar').setAttribute(
        'value', report.testIndex / report.testCount * 100 + '%');
    _(wTestCaseReport, 'total-counter').value = report.testCount;

    if(report.result == 'success') {
        var successes = parseInt(_(wTestCaseReport, 'success-counter').value);
        _(wTestCaseReport, 'success-counter').value = successes + 1;
        return;        
    }

    _(wTestCaseReport, 'bar').setAttribute('class', 'testcase-problems');

    var wTestReport = clone('test-report');
    _(wTestCaseReport, 'test-reports').appendChild(wTestReport);
    _(wTestReport, 'result').value = report.result.toUpperCase();
    _(wTestReport, 'icon').setAttribute('class', 'test-' + report.result);
    _(wTestReport, 'description').value = report.testDescription;
    _(wTestReport, 'description').setAttribute('tooltiptext', report.testDescription);
    if(report.exception) {
        _(wTestReport, 'additionalInfo').value = report.exception.message;
        if(report.exception.stack) {
            displayStackTrace(report.exception.stack, _(wTestReport, 'stack-trace'));
            _(wTestReport, 'stack-trace').hidden = false;
        }
    }
}

function displayStackTrace(trace, listbox) {
    for each(var line in trace.split('\n'))
        listbox.appendItem(line).setAttribute('crop', 'center');
}


function toggleContent() {
    _('content').collapsed = !_('content').collapsed;
    _('content-splitter').hidden = !_('content-splitter').hidden;
}

function hideSource() {
    _('source-viewer').collapsed = true;
    _('source-splitter').hidden = true;
}

function reset() {
    _('prerun-report', 'error').hidden = true;
    _('prerun-report', 'stack-trace').hidden = true;
    removeChildrenOf(_('prerun-report', 'stack-trace'));
    removeChildrenOf(_('testcase-reports'))
    hideSource();
}

function run() {
    reset();

    _('run').disabled = true;

    try {
        var suite = {};

        loader.loadSubScript(_('file').value, suite);

        var testsFound  = false;

        for(var thing in suite) {
            if(suite[thing] && suite[thing].__proto__ == mozunit.TestCase.prototype) {
                testsFound = true;
                var testCase = suite[thing];
                testCase.run({ onResult: testReportHandler });
            }
        }

        if(!testsFound)
            throw new Error('No tests found in ' + _('file').value);

    } catch(e) {
        _('prerun-report', 'error').value = 'Run failed. ' + e.toString();
        _('prerun-report', 'error').hidden = false;

        if(e.stack) {
            displayStackTrace(e.stack, _('prerun-report', 'stack-trace'));
            _('prerun-report', 'stack-trace').hidden = false;
            _('prerun-report').hidden = false;
        }
    }

    _('run').disabled = false;
}



function stylizeSource(sourceDocument, lineCallback) {
    var originalSource = sourceDocument.getElementsByTagName('pre')[0];
    var processedSource = sourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'pre');
    var sourceLines = originalSource.textContent.split('\n');
    var sourceLine, htmlLine, lineContent;
    for(var i=0, l=sourceLines.length; i<l; i++) {
        if(lineCallback) 
            htmlLine = lineCallback(sourceDocument, i+1, sourceLines[i]) ||
                sourceDocument.createTextNode(sourceLines[i]);

        processedSource.appendChild(htmlLine)
    }
    processedSource.normalize();
    originalSource.parentNode.replaceChild(processedSource, originalSource);

    var cssLink = sourceDocument.createElementNS('http://www.w3.org/1999/xhtml', 'link');
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    cssLink.href = 'data:text/css,' +
        'body { margin: 0; }' +
        '#current { font-weight: bold; background-color: #e5e5e5; }' +
        '.link { color: blue; border-bottom: thin solid blue; cursor: pointer; }';

    sourceDocument.getElementsByTagName('head')[0].appendChild(cssLink);
}

function openInEditor(fileUrl, lineNumber, columnNumber, commandLine) {
    lineNumber = lineNumber || 1;
    columnNumber = columnNumber || 1;
    commandLine = commandLine ||
        Components
        .classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch)
        .getCharPref('extensions.mozunit.editor') ||
        '/usr/bin/x-terminal-emulator -e /usr/bin/emacsclient -t +%l:%c %f';

    var executable = Components
        .classes["@mozilla.org/file/local;1"].
        createInstance(Components.interfaces.nsILocalFile);
    var process = Components
        .classes["@mozilla.org/process/util;1"].
        createInstance(Components.interfaces.nsIProcess);

    var argv = commandLine.split(/\s+/).map(
        function(word) {
            return word.
                replace('%l', lineNumber).
                replace('%c', columnNumber).
                replace('%u', fileUrl).
                replace('%f', fileUrlToPath(fileUrl));
        });

    var editorPath = argv.shift();
    executable.initWithPath(editorPath);
    try {
        process.init(executable);
        process.run(false, argv, argv.length);
    } catch(e) {
        window.alert('Error starting editor. (' + e.name + ')\n' +
                     'Please check "extensions.mozunit.editor" in about:config and ensure it points to a valid executable.');
    }
}

function showSource(traceLine) {
    var match = traceLine.match(/@(.*):(\d+)/);
    var sourceUrl = match[1];
    var lineNumber = match[2];

    if(sourceUrl) {
        
        var frame = _('source-viewer', 'source');
        _('source-splitter').hidden = false;
        _('source-viewer').collapsed = false;

        function onLoad(event) {
            _('source-viewer', 'source').removeEventListener('load', onLoad, true);

            stylizeSource(
                _('source-viewer', 'source').contentDocument,
                function(sourceDoc, number, content) {
                    content = padLeft(number, 3, 0) + ' ' + content + '\n';

                    if(number == lineNumber) {
                        var currentLine = sourceDoc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                        currentLine.setAttribute('id', 'current');
                        currentLine.textContent = content;

                        if(sourceUrl.match(/^file:\/\//)) {
                            currentLine.setAttribute('class', 'link');
                            currentLine.addEventListener(
                                'click', function(event) {
                                    openInEditor(sourceUrl, lineNumber);                                        
                                }, false);
                        }

                        return currentLine;
                    } else
                        return sourceDoc.createTextNode(content);
                        });

            _('source-viewer', 'source').contentWindow.scrollTo(
                0, (frame.contentDocument.getElementById('current').offsetTop -
                    frame.contentWindow.innerHeight/2));

        }

        _('source-viewer', 'source').addEventListener('load', onLoad, true);
        _('source-viewer', 'source').webNavigation.
            loadURI(sourceUrl, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE,
                    null, null, null);

    }
}

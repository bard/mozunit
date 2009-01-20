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

var EXPORTED_SYMBOLS = [
    'TestCase',
    'Specification'
];


/**
 * Invocation:
 *     var case = new TestCase('Widget tests');
 *     var case = new TestCase('Widget tests', {runStrategy: 'async'});
 *
 * Use async run strategy when test cases mustn't be run immediately
 * after test setup, for example when during setup a document is
 * loaded into the browser and the browser will signal when the
 * document has finished loading through a callback.
 *
 * Note: code inside tests will still run sequentially.  In some
 * cases, e.g. testing interfaces, this means you will do something to
 * affect the interface and then test the effect, before the interface
 * thread has had a chance to apply your request.  Control of flow
 * inside tests is work in progress.
 *
 * Alias:
 *     var spec = new Specification();
 *
 */

function TestCase(title, opts) {
    opts = opts || {};

    this._title = title;
    this._runStrategy = opts.runStrategy;
    this._tests = null;
}

TestCase.prototype.__defineSetter__('tests', function(hash) this.setTests(hash));

TestCase.prototype.__defineSetter__('stateThat', function(hash) this.setTests(hash));

TestCase.prototype.__defineSetter__('reportHandler', function(fn) this._reportHandler = fn);

TestCase.prototype.__defineGetter__('title', function() this._title);


/**
 * Define test cases, optionally with setup and teardown.
 *
 *     var case = new TestCase();
 *     case.tests = {
 *         setUp: function() {
 *             this.plusFactor = 4;
 *         },
 *
 *         testOperation: function() {
 *             assert.equals(8, 2+2+this.plusFactor);
 *         },
 *
 *         tearDown: function() {
 *             // release resources if necessary
 *         }
 *     }
 *
 * Every test is run in a context created ex-novo and accessible from
 * the test itself via the 'this' identifier.
 *
 * Aliases: setTests(), 'stateThat'.  'setUp' is also aliased to
 * 'given'.  'stateThat' and 'given' allow a more Behaviour-Driven
 * Development style.
 *
 *     var spec = new Specification();
 *     spec.stateThat = {
 *         given: function() {
 *             this.plusFactor = 4;
 *         },
 *
 *         'Adding two and two and plus factor yields eight': function() {
 *             assert.equals(8, 2+2+this.plusFactor);
 *         },
 *
 *         tearDown: function() {
 *             // release resources if necessary
 *         }
 *     }
 */

TestCase.prototype.setTests = function(hash) {
    this._tests = [];
    for(var desc in hash)
        if(desc == 'setUp' || desc == 'given')
            this._setUp = hash[desc];
        else if(desc == 'tearDown')
            this._tearDown = hash[desc];
        else
            this._tests.push({
                desc: desc,
                code: hash[desc]});
}

/**
 * Runs tests with strategy defined at construction time.
 *
 *    var case = new TestCase();
 *    case.tests = { ... };
 *    case.run();
 *
 */

TestCase.prototype.run = function(opts) {
    opts = opts || {};

    var test, context, report;
    var result = true;
    for(var i=0, l=this._tests.length; i<l; i++) {
        test = this._tests[i];
        context = {};
        report = _exec1(test.code, this._setUp, this._tearDown, context);
        report.testOwner = this;
        report.testDescription = test.desc;
        report.testCode = test.code;
        report.testIndex = i+1;
        report.testCount = l;
        report.toString = function() _defaultReportFormatter(this);

        if(report.result != 'success')
            result = false;

        if(typeof(opts.onResult) == 'function')
            opts.onResult(report);
    }

    return result;
}

/**
 * Alternative style for defining setup.
 *
 */

TestCase.prototype.setUp = function(fn) {
    this._setUp = fn;
}

/**
 * Alternative style for defining tests.  Can be called multiple
 * times.
 *
 */

TestCase.prototype.test = function(desc, code) {
    this._tests.push([desc, code]);
}

/**
 * Alternative style for defining teardown.
 *
 */

TestCase.prototype.tearDown = function(fn) {
    this._tearDown = fn;
}

/**
 * BDD-style alias for run().
 *
 *    var spec = new Specification();
 *    spec.stateThat = { ... };
 *    spec.verify();
 *
 */

TestCase.prototype.verify = function() {
    return this.run.apply(this, arguments);
}

/**
 * BDD-alias for setUp().
 *
 */

TestCase.prototype.given = function(fn) {
    this.setUp(fn);
}

/**
 * BDD-style alias for test().
 *
 */

TestCase.prototype.states = function(desc, fn) {
    this.test(desc, fn);
}

/*  Side effect-free functions. They're the ones who do the real job. :-) */

function _formatStackTrace1(exception) {
    function comesFromFramework(call) {
        return (call.match(/@chrome:\/\/mozunit\/content\/lib\/fsm\.js:/) ||
                call.match(/@chrome:\/\/mozunit\/content\/test_case\.js:/) ||
                // Following is VERY kludgy
                call.match(/\(function \(exitResult\) \{if \(eventHandlers/))
    }

    var trace = '';
    if(exception.stack) {
        var calls = exception.stack.split('\n');
        for each(var call in calls) {
            if(call.length > 0 && !comesFromFramework(call)) {
                call = call.replace(/\\n/g, '\n');

                if(call.length > 200)
                    call =
                        call.substr(0, 100) + ' [...] ' +
                        call.substr(call.length - 100) + '\n';

                trace += call + '\n';
            }
        }
    }
    return trace;
}

function _exec1(code, setUp, tearDown, context) {
    var report = {
        result:    undefined,
        exception: undefined
    };

    try {
        if(setUp)
            setUp.call(context);

        code.call(context);

        if(tearDown)
            tearDown.call(context);

        report.result = 'success';
    } catch(exception if exception.name == 'AssertionFailed') {
        report.result = 'failure';
        report.exception = exception;
    } catch(exception) {
        report.result = 'error';
        report.exception = exception;
    }

    return report;
}

function _defaultReportFormatter(report) {
    if(report.result == 'success')
        return;

    var printout = '';
    printout += 'Test ' + report.testIndex + '/' + report.testCount + ': ';
    printout += report.testDescription + '\n';

    printout += report.result.toUpperCase();
    if(report.exception) {
        printout += ': ' + report.exception + '\n';
        printout += _formatStackTrace1(report.exception);
    }
    printout += '\n';

    return printout;
}

var Specification = TestCase;

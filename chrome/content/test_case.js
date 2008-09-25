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

function constructor(title, opts) {
    opts = opts || {};

    this._title = title;
    this._runStrategy = opts.runStrategy;
    this._tests = [];
    this._reportHandler = _defaultReportHandler;

    this.__defineSetter__(
        'tests', function(hash) {
            this.setTests(hash);
        });

    this.__defineSetter__(
        'stateThat', function(hash) {
            this.setTests(hash);
        });

    this.__defineSetter__(
        'reportHandler', function(callback) {
            this._reportHandler = callback;
        });

    this.__defineGetter__(
        'title', function() {
            return this._title;
        });
}

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

function setTests(hash) {
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

function run() {
    this[this._runStrategy == 'async' ? '_asyncRun1' : '_syncRun1']
	(
	 this._tests,
	 this._setUp != null ? this._setUp : null,
	 this._tearDown != null ? this._tearDown : null,
	 this._reportHandler);
}

/**
 * Alternative style for defining setup.
 *
 */

function setUp(fn) {
    this._setUp = fn;
}

/**
 * Alternative style for defining tests.  Can be called multiple
 * times.
 *
 */

function test(desc, code) {
    this._tests.push([desc, code]);
}

/**
 * Alternative style for defining teardown.
 *
 */

function tearDown(fn) {
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

function verify() {
    this.run();
}

/**
 * BDD-alias for setUp().
 *
 */

function given(fn) {
    this.setUp(fn);
}

/**
 * BDD-style alias for test().
 *
 */

function states(desc, fn) {
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

function _syncRun1(tests, setUp, tearDown, reportHandler) {
    var test, context, report;
    for(var i=0, l=tests.length; i<l; i++) {
        test = tests[i];
        context = {};
        report = _exec1(test.code, setUp, tearDown, context);
        report.testOwner = this;
        report.testDescription = test.desc;
        report.testCode = test.code;
        report.testIndex = i+1;
        report.testCount = l;
        reportHandler(report);
    }
}

if(false) {
    // asynchronous running is not ready, don't make it available.
function _asyncRun1(tests, setUp, tearDown, reportHandler, onTestRunFinished) {
    var testIndex = 0;
    var context;
    var report;

    var stateTransitions = {
        start:      { ok: 'doSetUp' },
        doSetUp:    { ok: 'doTest', ko: 'doReport' },
        doTest:     { ok: 'doReport' },
        doReport:   { ok: 'doTearDown' },
        doTearDown: { ok: 'nextTest', ko: 'nextTest' },
        nextTest:   { ok: 'doSetUp', ko: 'finished' },
        finished:   { }
    }

    _this = this;
    var stateHandlers = {
        start: function(continuation) {
            continuation('ok')
        },
        doSetUp: function(continuation) {
            context = {};
            report = {};
            try {
                setUp.call(context, continuation);
            } catch(e) {
                report.result = 'error';
                report.exception = e;
                report.testDescription = 'Setup';
                continuation('ko');
            }
        },
        doTest: function(continuation) {
            var test;
            test = tests[testIndex];
            report = _exec1(test.code, null, null, context);
            report.testDescription = test.desc;
            continuation('ok');
        },
        doReport: function(continuation) {
            report.testOwner = _this;
            report.testIndex = testIndex + 1;
            report.testCount = tests.length;
            reportHandler(report);
            continuation('ok');
        },
        doTearDown: function(continuation) { // exceptions in setup/teardown are not reported correctly
            try {
                // perhaps should pass continuation to tearDown as well
                tearDown.call(context); 
                continuation('ok');
            } catch(e) {
                continuation('ko');
            }
        },
        nextTest: function(continuation) {
            testIndex += 1;
            tests[testIndex] ? continuation('ok') : continuation('ko');
        },
        finished: function(continuation) {
            if(onTestRunFinished)
                onTestRunFinished();
        }
    }

    fsm.go('start', {}, stateHandlers, stateTransitions, []);
}
}

function _defaultReportHandler(report) {
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
        

    if(typeof(repl) == 'object')
        repl.print(printout);
    else
        dump(printout);
}
import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,scenarios,bookingPrice} from '../lib/finance.ts';
test('classroom scenarios match independent expected results',()=>{for(const [name,profit] of Object.entries({Downside:-429670,Base:-138240,Upside:256600})){assert.equal(calculate(scenarios[name]).profit,profit)}});
test('base unit contribution and break-even threshold',()=>{const f=calculate(scenarios.Base);assert.equal(f.contribution,67.4);assert.equal(f.breakEven,4452);assert.ok(4452*f.contribution+f.b2b-scenarios.Base.fixed>=0);assert.ok(4451*f.contribution+f.b2b-scenarios.Base.fixed<0)});
test('nonpositive contribution cannot recover fixed cost through volume',()=>{assert.equal(calculate({...scenarios.Base,commission:0}).breakEven,null);assert.equal(calculate({...scenarios.Base,fixed:0}).breakEven,0)});
test('booking duration price and invalid ranges',()=>{assert.equal(bookingPrice(0,7200000,400),800);assert.throws(()=>bookingPrice(0,0,400));assert.throws(()=>bookingPrice(0,90000000,400));assert.throws(()=>bookingPrice(NaN,7200000,400))});

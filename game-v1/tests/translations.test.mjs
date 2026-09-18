import test from 'node:test';
import assert from 'node:assert/strict';
import {showEnglish,reachedLevel} from '../systems/translations.mjs';
test('default English assistance stops exactly when level 10 is reached',()=>{
 assert.equal(showEnglish({settings:{},level:1}),true);
 assert.equal(showEnglish({settings:{},level:9}),true);
 assert.equal(showEnglish({settings:{},level:10}),false);
 assert.equal(showEnglish({settings:{},level:11}),false);
});
test('always/never override level and automatic assistance respects previous journeys',()=>{
 assert.equal(showEnglish({settings:{englishTranslations:'always'},level:25}),true);
 assert.equal(showEnglish({settings:{englishTranslations:'never'},level:1}),false);
 assert.equal(showEnglish({settings:{englishTranslations:'until10'},level:1,highestLevel:10}),false);
 assert.equal(reachedLevel({history:{L12:true},level:1}),12);
});

import {Future, HashMap, None, Option, Vector} from "prelude.ts";

export module Helper {
    // why promisify: https://stackoverflow.com/questions/33445415/javascript-promises-reject-vs-throw/33446005#33446005
    export function timeout(duration: number) {
        return new Promise(function(resolve) {
            setTimeout(resolve, duration);
        });
    }
    
    export function extractSingleHashtagNumber(value: string): Option<number>{
        let hashtags: RegExpMatchArray | null = value.match(/#[0-9]+/gi);
        return Option.ofNullable(hashtags)
            .filter(h => h.length === 1)
            .map(h => parseInt(h[0].substr(1)));
    }
    
    export function combineWithArrowIfNotEqual(str1: string | number, str2: string | number): string {
        return String(str1) === String(str2) ? String(str1) : str1 + ' --> ' + str2;
    }
    // export function truncateStringWithEllipses(str: string, maxLen: number): string {
    //     return str.substr(0,maxLen - 1)+(str.length > maxLen ? '...' : '');
    // }
}
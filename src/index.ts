import * as taskManager from './managers/tasks';
import ProviderAsync from './providers/async';
import Provider from './providers/provider';
import ProviderStream from './providers/stream';
import ProviderSync from './providers/sync';
import Settings, { Options as OptionsInternal } from './settings';
import { Entry as EntryInternal, EntryItem, FileSystemAdapter as FileSystemAdapterInternal, Pattern as PatternInternal } from './types/index';
import * as utils from './utils/index';

type EntryObjectModePredicate = { [P in keyof Pick<OptionsInternal, 'objectMode'>]-?: true };
type EntryStatsPredicate = { [P in keyof Pick<OptionsInternal, 'stats'>]-?: true };
type EntryObjectPredicate = EntryObjectModePredicate | EntryStatsPredicate;

function FastGlob(source: PatternInternal | PatternInternal[], options: OptionsInternal & EntryObjectPredicate): Promise<EntryInternal[]>;
function FastGlob(source: PatternInternal | PatternInternal[], options?: OptionsInternal): Promise<string[]>;
function FastGlob(source: PatternInternal | PatternInternal[], options?: OptionsInternal): Promise<EntryItem[]> {
	try {
		assertPatternsInput(source);
	} catch (error) {
		return Promise.reject(error);
	}

	const works = getWorks(source, ProviderAsync, options);

	return Promise.all(works).then(utils.array.flatten);
}

namespace FastGlob {
	export type Options = OptionsInternal;
	export type Entry = EntryInternal;
	export type Task = taskManager.Task;
	export type Pattern = PatternInternal;
	export type FileSystemAdapter = FileSystemAdapterInternal;
	
	export function async(source: PatternInternal | PatternInternal[], options: OptionsInternal & EntryObjectPredicate): Promise<EntryInternal[]>;
	export function async(source: PatternInternal | PatternInternal[], options?: OptionsInternal): Promise<string[]>;
	export function async(source: PatternInternal | PatternInternal[], options?: OptionsInternal): Promise<EntryItem[]> {
		return FastGlob(source, options)
	}

	export function sync(source: PatternInternal | PatternInternal[], options: OptionsInternal & EntryObjectPredicate): EntryInternal[];
	export function sync(source: PatternInternal | PatternInternal[], options?: OptionsInternal): string[];
	export function sync(source: PatternInternal | PatternInternal[], options?: OptionsInternal): EntryItem[] {
		assertPatternsInput(source);

		const works = getWorks(source, ProviderSync, options);

		return utils.array.flatten(works);
	}

	export function stream(source: PatternInternal | PatternInternal[], options?: OptionsInternal): NodeJS.ReadableStream {
		assertPatternsInput(source);

		const works = getWorks(source, ProviderStream, options);

		/**
		 * The stream returned by the provider cannot work with an asynchronous iterator.
		 * To support asynchronous iterators, regardless of the number of tasks, we always multiplex streams.
		 * This affects performance (+25%). I don't see best solution right now.
		 */
		return utils.stream.merge(works);
	}

	export function generateTasks(source: PatternInternal | PatternInternal[], options?: OptionsInternal): Task[] {
		assertPatternsInput(source);

		const patterns = ([] as PatternInternal[]).concat(source);
		const settings = new Settings(options);

		return taskManager.generate(patterns, settings);
	}
}

function getWorks<T>(source: PatternInternal | PatternInternal[], _Provider: new (settings: Settings) => Provider<T>, options?: OptionsInternal): T[] {
	const patterns = ([] as PatternInternal[]).concat(source);
	const settings = new Settings(options);

	const tasks = taskManager.generate(patterns, settings);
	const provider = new _Provider(settings);

	return tasks.map(provider.read, provider);
}

function assertPatternsInput(source: unknown): void | never {
	if (([] as unknown[]).concat(source).every(isString)) {
		return;
	}

	throw new TypeError('Patterns must be a string or an array of strings');
}

function isString(source: unknown): source is string {
	/* tslint:disable-next-line strict-type-predicates */
	return typeof source === 'string';
}

export = FastGlob;

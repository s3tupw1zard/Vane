import academicSearchAction from './search/academicSearch';
import doneAction from './done';
import planAction from './plan';
import ActionRegistry from './registry';
import socialSearchAction from './search/socialSearch';
import uploadsSearchAction from './uploadsSearch';
import webSearchAction from './search/webSearch';

ActionRegistry.register(webSearchAction);
ActionRegistry.register(doneAction);
ActionRegistry.register(planAction);
ActionRegistry.register(uploadsSearchAction);
ActionRegistry.register(academicSearchAction);
ActionRegistry.register(socialSearchAction);

export { ActionRegistry };

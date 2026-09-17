import type { INodeProperties } from 'n8n-workflow';
import { formDescription, formResponseDescription } from './form';
import { messageDescription } from './message';
import { planDescription } from './plan';
import { programDescription, programTemplateDescription } from './program';
import { resourceProperty } from './shared';
import { coachDescription, studioDescription, tagDescription } from './studio';
import { taskDescription } from './task';
import { traineeDescription } from './trainee';
import { weightDescription } from './weight';

export { resourceProperty };

export const descriptions: INodeProperties[] = [
	resourceProperty,
	...traineeDescription,
	...planDescription,
	...programDescription,
	...programTemplateDescription,
	...formDescription,
	...formResponseDescription,
	...taskDescription,
	...messageDescription,
	...weightDescription,
	...coachDescription,
	...tagDescription,
	...studioDescription,
];

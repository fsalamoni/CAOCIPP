import * as admin from 'firebase-admin';

admin.initializeApp();

// Export function modules
export { createOrganization } from './organizations/create';
export { getUserOrganizations } from './organizations/getUser';
export { joinOrganization } from './organizations/join';
export { removeMember } from './organizations/removeMember';
export { updateMember } from './organizations/updateMember';

export { createProcess } from './processes/create';
export { updateProcess } from './processes/update';
export { deleteProcess } from './processes/delete';
export { calculateProcessStatus } from './processes/calculateStatus';

export { updateProfile } from './user/updateProfile';

export { importProcessesFromExcel } from './import/fromExcel';

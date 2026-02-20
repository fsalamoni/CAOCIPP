"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importProcessesFromExcel = exports.updateProfile = exports.backfillProcessLogs = exports.calculateProcessStatus = exports.deleteProcess = exports.updateProcess = exports.createProcess = exports.updateOrganization = exports.clearOrganizationData = exports.updateMember = exports.removeMember = exports.joinOrganization = exports.getUserOrganizations = exports.createOrganization = void 0;
const admin = require("firebase-admin");
admin.initializeApp();
// Export function modules
var create_1 = require("./organizations/create");
Object.defineProperty(exports, "createOrganization", { enumerable: true, get: function () { return create_1.createOrganization; } });
var getUser_1 = require("./organizations/getUser");
Object.defineProperty(exports, "getUserOrganizations", { enumerable: true, get: function () { return getUser_1.getUserOrganizations; } });
var join_1 = require("./organizations/join");
Object.defineProperty(exports, "joinOrganization", { enumerable: true, get: function () { return join_1.joinOrganization; } });
var removeMember_1 = require("./organizations/removeMember");
Object.defineProperty(exports, "removeMember", { enumerable: true, get: function () { return removeMember_1.removeMember; } });
var updateMember_1 = require("./organizations/updateMember");
Object.defineProperty(exports, "updateMember", { enumerable: true, get: function () { return updateMember_1.updateMember; } });
var clearData_1 = require("./organizations/clearData");
Object.defineProperty(exports, "clearOrganizationData", { enumerable: true, get: function () { return clearData_1.clearOrganizationData; } });
var update_1 = require("./organizations/update");
Object.defineProperty(exports, "updateOrganization", { enumerable: true, get: function () { return update_1.updateOrganization; } });
var create_2 = require("./processes/create");
Object.defineProperty(exports, "createProcess", { enumerable: true, get: function () { return create_2.createProcess; } });
var update_2 = require("./processes/update");
Object.defineProperty(exports, "updateProcess", { enumerable: true, get: function () { return update_2.updateProcess; } });
var delete_1 = require("./processes/delete");
Object.defineProperty(exports, "deleteProcess", { enumerable: true, get: function () { return delete_1.deleteProcess; } });
var calculateStatus_1 = require("./processes/calculateStatus");
Object.defineProperty(exports, "calculateProcessStatus", { enumerable: true, get: function () { return calculateStatus_1.calculateProcessStatus; } });
var backfillLogs_1 = require("./processes/backfillLogs");
Object.defineProperty(exports, "backfillProcessLogs", { enumerable: true, get: function () { return backfillLogs_1.backfillProcessLogs; } });
var updateProfile_1 = require("./user/updateProfile");
Object.defineProperty(exports, "updateProfile", { enumerable: true, get: function () { return updateProfile_1.updateProfile; } });
var fromExcel_1 = require("./import/fromExcel");
Object.defineProperty(exports, "importProcessesFromExcel", { enumerable: true, get: function () { return fromExcel_1.importProcessesFromExcel; } });
__exportStar(require("./temp/processAnalysisTools"), exports);
//# sourceMappingURL=index.js.map
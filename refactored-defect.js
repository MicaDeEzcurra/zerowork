const { dbConnecter } = require("./dbConnector");
const { logger } = require("./logger");
const moment = require("moment-timezone");

const { machineInfo } = require("./machine");
var mI = new machineInfo();
const { processInfo } = require("./process");
var processInfoObj = new processInfo();

const formatError = (code, message) => {
    let result = {};
    result["error"] = {};
    result["error"]["code"] = code;
    result["error"]["message"] = message;
    return result;
};

const handleError500 = (error) => {
    logError(error);
    return formatError(500, error.toString());
};

const log = (level, message) => {
    logger.log({
        level: level,
        message: message,
    });
};

const logErrorMessage = (message) => {
    log('error', message);
}

const logError = (error) => {
    logErrorMessage(error.toString());
};

const handleSuccess = (message) => {
    let result = {};
    result["success"] = message;
    return result;
}

const recordExist = (table, where) => {
    let result = (await dbConnecter
    .table(table)
    .where(where)
    .count()
    )[0].count;
    return result == 1;
}

class defectInfo {
	constructor() {}

	async getDefectInfo(machineId) {

		try {
            if (! recordExist("machine", { machine_id: machineId })) {
				return formatError(400, "Machine Id doesn't exist");
			}

            return dbConnecter
                .table("defect")
                .where({ machine_id: machineId })
                .then(async (result) => {
                    return result;
                })
                .catch(handleError500);
		} catch (error) {
            return handleError500(error);
		}
    }
    
	async setDefect(personalNumber, description, machineId) {
		try {

            if (! recordExist("worker_registry", { personal_number: personalNumber })) {
				return errorHandler(400, "Invalid personal number");
			}

            if (! recordExist("machine", { machine_id: machineId })) {
				return errorHandler(400, "Invalid machine id");
			}

			return dbConnecter
				.table("defect")
				.insert({
					personal_number: personalNumber,
					description: description,
					machine_id: machineId,
					defect_time: moment()
						.tz("Europe/Berlin")
						.format("YYYYMMDD HHmmss"),
					status: 1,
				})
				.then(async (result, error) => {
                    if (result.rowCount == "1") {
                        log("info", "Successfully set the defect for machine " +
								machineId +
								" with " +
								description +
								"by -" +
                            personalNumber);
                        return handleSuccess("Successfully set the defect")
					} else {
                        logErrorMessage("Failed to insert into defect");
                        return formatError(500, "Failed to insert into defect");
					}
				})
				.catch(handleError500);
		} catch (error) {
            return handleError500(error);
		}
	}

	async getDefectStatus(machineId) {
		try {
            if (! recordExist("machine", { machine_id: machineId })) {
				return errorHandler(400, "Machine Id doesn't exist");
            }
            
			return dbConnecter
				.table("defect")
				.where({ machine_id: machineId })
				.orderBy("defect_time", "desc")
				.then(async (result) => {
					return result[0];
				})
				.catch(handleError500);
        } catch (error) {
            return handleError500(error);
		}
	}

	async setDefectStatus(machineId, defect_time, status) {
		try {
			console.log(
				dbConnecter
					.table("defect")
					.update({ status: status })
					.where({ machine_id: machineId })
					.andWhere({ defect_time: defect_time })
					.toString()
			);
			return dbConnecter
				.table("defect")
				.update({ status: status })
				.where({ machine_id: machineId })
				.andWhere({ defect_time: defect_time })
				.then(async (result) => {
					console.log(result);
					if (status == "3" && result == 1) {
						let result = await mI.setMachineStatus(machineId, 1);
						console.log(result);
                        if (result.success != "") {
                            log("info", "Successfully updated and set the status of the machine " +
                                machineId);
                            return handleSuccess("Successfully updated and set the status of the machine " +
                                machineId);
                        } else {
                            logErrorMessage("Failed to set the status of the machine" +
                                machineId);
                            formatError(500,"Failed to set the status of the machine" +
								machineId)
						}
                    } else if (result == 1) {
                        return handleSuccess("Successfully updated the status of defect ");
                    } else {
                        return formatError(500, "Failed to set the status of the machine");
					}
				})
                .catch(handleError500);
		} catch (error) {
            handleError500(error);
		}
	}

	async getAllDefect() {
		try {
			let allDefect = {};

			return dbConnecter
				.table("defect")
				.join(
					"worker_registry",
					"defect.personal_number",
					"=",
					"worker_registry.personal_number"
				)
				.select()
				.where({ "defect.status": 1 })
				.then(async (result) => {
					allDefect["pending"] = result;
					console.log(result.length);
					return dbConnecter
						.table("defect")
						.join(
							"worker_registry",
							"defect.personal_number",
							"=",
							"worker_registry.personal_number"
						)
						.select()
						.where({ "defect.status": 2 })
						.then(async (result) => {
							allDefect["in_process"] = result;
							console.log(result.length);

							return dbConnecter
								.table("defect")
								.join(
									"worker_registry",
									"defect.personal_number",
									"=",
									"worker_registry.personal_number"
								)
								.select()
								.where({ "defect.status": 3 })
								.then(async (result) => {
									allDefect["completed"] = result;
									console.log(result.length);

									return allDefect;
								});
						})
						.catch(handleError500);
				});
		} catch (error) {
            handleError500(error);
		}
	}
}

module.exports.defectInfo = defectInfo;

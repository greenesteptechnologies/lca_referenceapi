export function successResponse(data: any, message = "Success") {
	return {
		success: true,
		message,
		data,
	};
}

export function errorResponse(message = "Error", data: any = null) {
	return {
		success: false,
		message,
		data,
	};
}

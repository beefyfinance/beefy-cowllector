export const settledPromiseRejected = (result: PromiseSettledResult< unknown>) : 
																result is PromiseRejectedResult => 
																									'rejected' === result.status;
export const settledPromiseFilled = <T> (result: PromiseSettledResult< T>) : 
																	result is PromiseFulfilledResult< T> => 
																									'fulfilled' === result.status;


export const settledPromiseRejected = (result: PromiseSettledResult< unknown>) :
																				result is PromiseRejectedResult => 
																									'rejected' === result.status;
export const settledPromiseFilled = <T> (result: PromiseSettledResult< T>) : 
																				result is PromiseFulfilledResult< T> => 
																									'fulfilled' === result.status;

export const swapKeyValues = <T extends Record< string, string | number>> 
																						(obj: T, numeric?: boolean) : 
																						{ [K in keyof T as T[ "K"]]: K} => 
											Object.fromEntries( Object.entries( <any> obj).map( 
											([key, value]) => [value, numeric ? parseInt( key) : key]));
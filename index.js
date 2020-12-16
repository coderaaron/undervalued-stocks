/* eslint-disable no-console */
const fs = require( 'fs' );
const fetch = require( 'node-fetch' );
const clear = require( 'clear' );
const figlet = require( 'figlet' );
const chalk = require( 'chalk' );
const jsonfile = require( 'jsonfile' );
const _ = require( 'lodash' );
const JSSoup = require( 'jssoup' ).default;
// eslint-disable-next-line prefer-const
let dataForAnalysis = [];

class HTTPResponseError extends Error {
	constructor( response, ...args ) {
		super(
			`HTTP Error Response: ${ response.status } ${ response.statusText }`,
			...args
		);
		this.response = response;
	}
}

const checkStatus = ( response ) => {
	if ( response.ok ) {
		// response.status >= 200 && response.status < 300
		return response;
	}
	throw new HTTPResponseError( response );
};

const getSandPList = async () => {
	console.log( 'Querying Wikipedia...' );
	return fetch( 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies' )
		.then( ( res ) => res.text() )
		.then( ( body ) => body );
};

const updateSandPList = async () => {
	const tickers = [];
	const listHTML = await getSandPList();
	const soup = new JSSoup( listHTML );
	const table = soup.find( 'table', { id: 'constituents' } );

	console.log( 'Checking to make sure we have a good table...' );
	const header = table.findAll( 'th' );
	if ( 'Symbol' !== header[ 0 ].text ) {
		console.log( chalk.red( 'Houston, we have a problem!' ) );
	}

	const rows = table.findAll( 'tr' );
	console.log( 'Parsing rows...' );
	for ( const row of rows ) {
		const fields = row.findAll( 'td' );
		if ( fields.length === 0 ) {
			continue;
		}
		tickers.push( fields[ 0 ].text );
	}
	return tickers;
};

const getQuote = async ( s ) => {
	return fetch(
		'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' +
			s +
			'?modules=defaultKeyStatistics,summaryDetail,recommendationTrend,earnings,summaryProfile&formatted=false'
	)
		.then( checkStatus )
		.then( ( res ) => res.json() )
		.then( ( json ) => {
			const fullResults = json.quoteSummary.result[ 0 ];

			// eslint-disable-next-line prefer-const
			let filteredResults = _.pick(
				fullResults.defaultKeyStatistics,
				'52WeekChange',
				'earningsQuarterlyGrowth',
				'forwardEps',
				'forwardPE',
				'pegRatio',
				'priceToBook',
				'profitMargins',
				'trailingEps'
			);

			return {
				...filteredResults,
				regularMarketPreviousClose:
					fullResults.summaryDetail.regularMarketPreviousClose,
				recommendationTrend: fullResults.recommendationTrend.trend[ 0 ],
				earningsDate:
					fullResults.earnings.earningsChart.earningsDate[ 0 ],
				sector: fullResults.summaryProfile.sector,
				symbol: s,
			};
		} );
};

const moreThanaDay = ( filename ) => {
	// fetch file details
	const timeSinceModified = fs.stat( filename, ( err, stats ) => {
		if ( err ) {
			throw err;
		}

		// milliseconds since data modified
		return Date.now() - stats.mtime;
	} );

	// One day in milliseconds
	const ONE_DAY = 24 * 60 * 60 * 1000;

	if ( timeSinceModified > ONE_DAY ) {
		return true;
	}
	return false;
};

async function main() {
	if ( moreThanaDay( 'splist.json' ) ) {
		const tickers = await updateSandPList();

		jsonfile.writeFile( 'splist.json', tickers, {}, function ( err ) {
			if ( err ) console.log( err );
		} );
	} else {
		const tickers = require( 'splist.json' );
	}

	/* console.log( 'Start fetching the data from Yahoo!' );
	for ( const ticker of tickers ) {
		try {
			const contents = await getQuote( ticker );
			dataForAnalysis.push( contents );
		} catch ( error ) {
			console.log( error );
		}
	}

	jsonfile.writeFile(
		'spdata.json',
		dataForAnalysis,
		{ spaces: 2, finalEOL: false },
		function ( err ) {
			if ( err ) console.log( err );
		}
	); */

	//profitable();
	//giveaway();
	//bestFuture();
	//future();
	//dark();
	//sortAndValue();
}

//*************************************
// Usage
//
// spdata is data grabbed from rapid api / yahoo finance. To update this data run the function getStocks()
// getStocks will fetch all the s&p 500 company data, store it in a variable spdata and spit it out in a file.
//
// The s&p500 json dataset can be found here https://pkgstore.datahub.io/core/s-and-p-500-companies/constituents_json/data/64dd3e9582b936b0352fdd826ecd3c95/constituents_json.json
// and here https://datahub.io/core/s-and-p-500-companies#data
//
// Execute sortAndValue() from the console to process spdata. Each company is rated based on three different
// metrics: profit to book value, quarertly earnings, forwardEps minus trailingEps
// The lower rating the better. Each rating is summed to give the total rating.
//
// For example all s&p500 companies are sorted by profitToBookValue ratio. The number 1 company recieves 1 point
// the number 2 company recieves 2 points and so forth.
//
// This is repeated for the other two metrics. It would be nice if a company excelled at all three metrics and
// only recieved 3 points total but that's not realisitic. A low profit to book value means the company stock
// price is under valued. If such a company also has good quarterly earnings growth and a good forward outlook
// then it is super under valued. And that is the point of this exercise.
//
// The results of the processing are spit out to the console and downloaded as a cvs file
//
// Enjoy!
//*************************************

//highly profitable that's also down
const profitable = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Profitable' ) ) );
	const p = dataForAnalysis
		.filter( function ( a ) {
			try {
				return (
					a.earningsQuarterlyGrowth > 1 && a[ '52WeekChange' ] < -0.1
				);
			} catch ( ex ) {}
		} )
		.sort( function ( a, b ) {
			return b.earningsQuarterlyGrowth - a.earningsQuarterlyGrowth;
		} );
	p.forEach( ( element ) => console.log( element ) );
};

//book value less than price!
const giveaway = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Giveaway' ) ) );
	const p = dataForAnalysis
		.filter( function ( a ) {
			try {
				return (
					a.priceToBook < 1 &&
					a[ '52WeekChange' ] < -0.1 &&
					a.profitMargins > 0.1 &&
					a.earningsQuarterlyGrowth > 0
				);
			} catch ( ex ) {}
		} )
		.sort( function ( a, b ) {
			return a.priceToBook - b.priceToBook;
		} );
	p.forEach( ( element ) => console.log( element ) );
};

//who is the brightest
const bestFuture = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Brightest' ) ) );
	const p = dataForAnalysis
		.filter( function ( a ) {
			try {
				if (
					typeof a.forwardEps !== 'undefined' &&
					typeof a.trailingEps !== 'undefined' &&
					a.forwardEps / a.trailingEps > 1.25 &&
					a.profitMargins > 0.1 &&
					a.earningsQuarterlyGrowth > 0
				)
					return a;
			} catch ( ex ) {}
		} )
		.sort( function ( a, b ) {
			if (
				typeof a.forwardEps !== 'undefined' &&
				typeof b.forwardEps !== 'undefined'
			)
				return (
					b.forwardEps -
					b.trailingEps -
					( a.forwardEps - a.trailingEps )
				);
		} );
	p.forEach( ( element ) => console.log( element.symbol ) );
};

//future is bright
const future = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Bright' ) ) );
	const p = dataForAnalysis
		.filter( function ( a ) {
			try {
				return a.trailingEps <= a.forwardEps;
			} catch ( ex ) {}
		} )
		.sort( function ( a, b ) {
			return a.forwardEps - b.forwardEps;
		} );
	p.forEach( ( element ) => console.log( element.symbol ) );
};

//future is dark
const dark = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Dark' ) ) );
	const p = dataForAnalysis
		.filter( function ( a ) {
			try {
				return a.forwardEps < 0;
			} catch ( ex ) {}
		} )
		.sort( function ( a, b ) {
			return a.forwardEps - b.forwardEps;
		} );
	p.forEach( ( element ) => console.log( element.symbol ) );
};

const sortAndValue = () => {
	console.log( chalk.red( figlet.textSync( 'Starting Main Processing' ) ) );

	if ( dataForAnalysis.length === 0 ) {
		console.log( 'Reading data from file' );
		dataForAnalysis = require( './spdata.json' );
	}

	let bestFutureValue = [];
	_.forEach( dataForAnalysis, function ( a, b ) {
		if ( typeof a.forwardPE === 'undefined' ) {
			a.forwardPE = {};
			a.forwardPE = 9999;
		}
		if ( a.forwardPE <= 0 ) a.forwardPE = 9999;
		bestFutureValue.push( JSON.parse( JSON.stringify( a ) ) );
	} );
	bestFutureValue = bestFutureValue.sort( function ( a, b ) {
		if (
			typeof a !== 'undefined' &&
			typeof b !== 'undefined' &&
			typeof b.forwardPE !== 'undefined' &&
			typeof a.forwardPE !== 'undefined' &&
			typeof b.regularMarketPreviousClose !== 'undefined'
		)
			return a.forwardPE - b.forwardPE;
	} );
	_.forEach( bestFutureValue, function ( a, b ) {
		a.value = b + 1;
		//more severe penalty
		if ( a.forwardPE === 9999 ) {
			a.value = 9999;
		}
	} );

	let pegValue = [];
	_.forEach( dataForAnalysis, function ( a ) {
		if ( typeof a.pegRatio === 'undefined' ) {
			a.pegRatio = 9999;
		}
		if ( a.pegRatio <= 0 ) a.pegRatio = 9999;

		pegValue.push( JSON.parse( JSON.stringify( a ) ) );
	} );
	pegValue = pegValue.sort( function ( a, b ) {
		return a.pegRatio - b.pegRatio;
	} );
	_.forEach( pegValue, function ( a, b ) {
		a.value = b + 1;
		//more severe penalty
		if ( a.pegRatio === 9999 ) {
			a.value = 9999;
		}
	} );

	let f2WeekChange = [];
	_.forEach( dataForAnalysis, function ( a ) {
		if ( typeof a[ '52WeekChange' ] === 'undefined' ) {
			a[ '52WeekChange' ] = 9999;
		}
		f2WeekChange.push( JSON.parse( JSON.stringify( a ) ) );
	} );
	f2WeekChange = f2WeekChange.sort( function ( a, b ) {
		return a[ '52WeekChange' ] - b[ '52WeekChange' ];
	} );
	_.forEach( f2WeekChange, function ( a, b ) {
		a.value = b + 1;
		//more severe penalty
		if ( a[ '52WeekChange' ] === 9999 ) {
			a.value = 9999;
		}
	} );

	let giveawayValue = [];
	_.forEach( dataForAnalysis, function ( a ) {
		if ( typeof a.priceToBook === 'undefined' ) {
			a.priceToaook = 9999;
		}
		giveawayValue.push( JSON.parse( JSON.stringify( a ) ) );
	} );
	giveawayValue = giveawayValue.sort( function ( a, b ) {
		return a.priceToBook - b.priceToBook;
	} );
	_.forEach( giveawayValue, function ( a, b ) {
		a.value = b + 1;
		//more severe penalty
		if ( a.priceToBook === 9999 ) {
			a.value = 9999;
		}
	} );

	let profitableValue = [];
	_.forEach( dataForAnalysis, function ( a ) {
		if ( typeof a.earningsQuarterlyGrowth === 'undefined' )
			a.earningsQuarterlyGrowth = -9999;
		profitableValue.push( JSON.parse( JSON.stringify( a ) ) );
	} );
	profitableValue = profitableValue.sort( function ( a, b ) {
		return b.earningsQuarterlyGrowth - a.earningsQuarterlyGrowth;
	} );
	_.forEach( profitableValue, function ( a, b ) {
		a.value = b + 1;
		//more severe penalty
		if ( a.earningsQuarterlyGrowth === -9999 ) {
			a.value = 9999;
		}
	} );

	_.forEach( dataForAnalysis, function ( r ) {
		r._totalValue = 0;
		r._profitableValue = 9999;
		r._giveawayValue = 9999;
		r._bestFutureValue = 9999;
		r._pegRatioValue = 9999;
		r._f2WeekChange = 9999;
		_.forEach( f2WeekChange, function ( b ) {
			if ( r.symbol === b.symbol ) {
				r._f2WeekChange = b.value;
			}
		} );
		_.forEach( pegValue, function ( b ) {
			if ( r.symbol === b.symbol ) {
				r._pegRatioValue = b.value;
			}
		} );
		_.forEach( profitableValue, function ( b ) {
			if ( r.symbol === b.symbol ) {
				r._profitableValue = b.value;
			}
		} );
		_.forEach( giveawayValue, function ( b ) {
			if ( r.symbol === b.symbol ) {
				r._giveawayValue = b.value;
			}
		} );
		_.forEach( bestFutureValue, function ( b ) {
			if ( r.symbol === b.symbol ) {
				r._bestFutureValue = b.value;
			}
		} );
		r._totalValue =
			r._bestFutureValue +
			r._giveawayValue +
			r._profitableValue +
			r._pegRatioValue +
			r._f2WeekChange;
	} );
	let totalValue = dataForAnalysis.filter( function ( a ) {
		return a._totalValue > 0;
	} );
	totalValue = totalValue.sort( function ( a, b ) {
		return a._totalValue - b._totalValue;
	} );
	let undervalued = '';
	const header =
		'Symbol, Total Value, Profitable Value, Giveaway Value, Best Future Value, earningsQuarterlyGrowth, priceToBook, forwardPE, pegRatio, 52WeekChange, marketPrice, Industry, earningsDate, recommendation\r\n';
	console.log( header );
	undervalued = undervalued + header;
	_.forEach( totalValue, function ( b ) {
		if ( typeof b.recommendationTrend !== 'undefined' ) {
			b.rec = JSON.stringify( b.recommendationTrend );
		}
		if ( typeof b.earningsDate !== 'undefined' ) {
			const milliseconds = b.earningsDate * 1000;
			const dateObject = new Date( milliseconds );
			const humanDateFormat = dateObject.toLocaleString();
			b.earningsDate = humanDateFormat;
		}
		if (
			typeof b.symbol !== 'undefined' &&
			typeof b._totalValue !== 'undefined' &&
			typeof b._profitableValue !== 'undefined' &&
			typeof b._giveawayValue !== 'undefined' &&
			typeof b._bestFutureValue !== 'undefined' &&
			typeof b.earningsQuarterlyGrowth !== 'undefined' &&
			typeof b.priceToBook !== 'undefined' &&
			typeof b.trailingEps !== 'undefined' &&
			typeof b.forwardEps !== 'undefined'
		) {
			const row =
				b.symbol +
				',' +
				b._totalValue +
				',' +
				b._profitableValue +
				',' +
				b._giveawayValue +
				',' +
				b._bestFutureValue +
				',' +
				b.earningsQuarterlyGrowth +
				',' +
				b.priceToBook +
				',' +
				b.forwardPE +
				',' +
				b.pegRatio +
				',' +
				b[ '52WeekChange' ] +
				',' +
				b.regularMarketPreviousClose +
				',' +
				b.sector +
				',' +
				b.earningsDate +
				',' +
				b.rec +
				'\r\n';
			console.log( row );
			undervalued = undervalued + row;
		}
	} );

	fs.writeFile( './undervalued.csv', undervalued, ( err ) => {
		if ( err ) {
			console.error( err );
		}
		console.log( chalk.red( figlet.textSync( 'ALL DONE' ) ) );
		console.log( 'check out undervalued.csv' );
	} );
};

//main();

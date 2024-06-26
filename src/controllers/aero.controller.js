/* eslint-disable no-console */
const httpStatus = require('http-status');
const { default: axios } = require('axios');

const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');

const AERO_API_URL = 'https://aeroapi.flightaware.com/aeroapi';

const searchFlights = catchAsync(async (req, res) => {
  // Get query params
  const { lat1, lon1, lat2, lon2 } = req.query;
  const initialUrl = `${AERO_API_URL}/flights/search?query=-latlong+%22${lat1}+${lon1}+${lat2}+${lon2}%22`;

  const headers = {
    Accept: 'application/json; charset=UTF-8',
    'x-apikey': config.aero_api_key,
  };

  let allFlights = [];
  let nextUrl = initialUrl;

  while (nextUrl) {
    // eslint-disable-next-line no-await-in-loop
    const response = await axios.get(nextUrl, { headers });
    const { flights, links } = response.data;
    if (flights && flights.length > 0) {
      allFlights = allFlights.concat(flights);
    }
    nextUrl = links && links.next ? `${AERO_API_URL}${links.next}` : null;
  }

  res.status(httpStatus.OK).send({ flights: allFlights });
});

const dummyData = Array(2000000).fill('a').join('');

const headers = {
  Accept: 'application/json; charset=UTF-8',
  'x-apikey': config.aero_api_key,
};

const searchFlightsPositions = catchAsync(async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const { lat1, lon1, lat2, lon2, maxHeight, start, end } = req.query;

  const now = new Date();
  const endDate = end ? new Date(end) : now;
  const startDate = start ? new Date(start) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  console.log('now', now);
  console.log('startDate', startDate);
  console.log('endDate', endDate);

  const timesteampGapMinutes = 15;
  const searchCount = (endDate.getTime() - startDate.getTime()) / (timesteampGapMinutes * 60 * 1000);
  console.log('searchCount', searchCount);

  const allFlights = [];

  const startLon = parseFloat(lon1) < parseFloat(lon2) ? parseFloat(lon1) : parseFloat(lon2);
  const endLon = parseFloat(lon1) < parseFloat(lon2) ? parseFloat(lon2) : parseFloat(lon1);
  const startLat = parseFloat(lat1) < parseFloat(lat2) ? parseFloat(lat1) : parseFloat(lat2);
  const endLat = parseFloat(lat1) < parseFloat(lat2) ? parseFloat(lat2) : parseFloat(lat1);

  for (let i = 0; i < searchCount; i += 1) {
    // Start from 24 hours ago
    const startTimeStamp = now.getTime() - (searchCount - i) * timesteampGapMinutes * 60 * 1000;
    const endTimeStamp = now.getTime() - (searchCount - i - 1) * timesteampGapMinutes * 60 * 1000;

    console.log('startTimeStamp', new Date(startTimeStamp));
    console.log('endTimeStamp', new Date(endTimeStamp));

    const maxHeightQuery = maxHeight ? `{<= alt ${maxHeight}} ` : '';

    const url = `${AERO_API_URL}/flights/search/positions?query=${maxHeightQuery}{>= lat ${startLat}} {>= lon ${startLon}} {<= lat ${endLat}} {<= lon ${endLon}} {>= clock ${Math.floor(
      startTimeStamp / 1000
    )}} {<= clock ${Math.floor(endTimeStamp / 1000)}}&unique_flights=true`;

    // eslint-disable-next-line no-console
    console.log(i, 'url', url);

    let nextUrl = url;

    const status = {
      index: i + 1,
      total: searchCount,
      start_date: new Date(startTimeStamp).toISOString(),
      end_date: new Date(endTimeStamp).toISOString(),
    };

    let sData = {
      status,
      dummyData,
    };

    res.write(`${JSON.stringify(sData)}hhh`);

    while (nextUrl) {
      // eslint-disable-next-line no-await-in-loop
      const response = await axios.get(nextUrl, { headers });
      const { positions, links } = response.data;

      // eslint-disable-next-line no-console
      console.log('positions', positions.length);

      if (positions && positions.length > 0) {
        for (let j = 0; j < positions.length; j += 1) {
          const position = positions[j];
          const flight = allFlights.find((f) => f.fa_flight_id === position.fa_flight_id);
          if (!flight) {
            // Fetch Flight Position
            // eslint-disable-next-line no-await-in-loop
            const flightResponse = await axios.get(`${AERO_API_URL}/flights/${position.fa_flight_id}/position`, { headers });
            // Fetch Flight track
            // eslint-disable-next-line no-await-in-loop
            const flightTrackResponse = await axios.get(`${AERO_API_URL}/flights/${position.fa_flight_id}/track`, {
              headers,
            });

            const flightData = {
              ...flightResponse.data,
              ...flightTrackResponse.data,
              dummyData,
            };

            sData = {
              flightData,
              status,
            };

            res.write(`${JSON.stringify(sData)}hhh`);

            // eslint-disable-next-line no-console
            console.log('flightData', position.fa_flight_id);

            allFlights.push(flightData);
          }
        }
      }
      nextUrl = links && links.next ? `${AERO_API_URL}${links.next}` : null;
    }
  }

  res.end();
  // res.status(httpStatus.OK).json({ flights: allFlights });
});

const searchFlightsPositionsByTimestamps = catchAsync(async (req, res) => {
  const { lat1, lon1, lat2, lon2, maxHeight, start, end } = req.query;

  const endDate = new Date(end);
  const startDate = new Date(start);

  const allFlights = [];

  const startLon = parseFloat(lon1) < parseFloat(lon2) ? parseFloat(lon1) : parseFloat(lon2);
  const endLon = parseFloat(lon1) < parseFloat(lon2) ? parseFloat(lon2) : parseFloat(lon1);
  const startLat = parseFloat(lat1) < parseFloat(lat2) ? parseFloat(lat1) : parseFloat(lat2);
  const endLat = parseFloat(lat1) < parseFloat(lat2) ? parseFloat(lat2) : parseFloat(lat1);

  const startTimeStamp = startDate.getTime();
  const endTimeStamp = endDate.getTime();

  const maxHeightQuery = maxHeight ? `{<= alt ${maxHeight}} ` : '';

  const url = `${AERO_API_URL}/flights/search/positions?query=${maxHeightQuery}{>= lat ${startLat}} {>= lon ${startLon}} {<= lat ${endLat}} {<= lon ${endLon}} {>= clock ${Math.floor(
    startTimeStamp / 1000
  )}} {<= clock ${Math.floor(endTimeStamp / 1000)}}&unique_flights=true`;

  // eslint-disable-next-line no-console
  console.log('url', url);

  let nextUrl = url;

  while (nextUrl) {
    // eslint-disable-next-line no-await-in-loop
    const response = await axios.get(nextUrl, { headers });
    const { positions, links } = response.data;

    // eslint-disable-next-line no-console
    console.log('positions', positions.length);

    if (positions && positions.length > 0) {
      for (let j = 0; j < positions.length; j += 1) {
        const position = positions[j];
        const flight = allFlights.find((f) => f.fa_flight_id === position.fa_flight_id);
        if (!flight) {
          // Fetch Flight Position
          // eslint-disable-next-line no-await-in-loop
          const flightResponse = await axios.get(`${AERO_API_URL}/flights/${position.fa_flight_id}/position`, { headers });
          // Fetch Flight track
          // eslint-disable-next-line no-await-in-loop
          const flightTrackResponse = await axios.get(`${AERO_API_URL}/flights/${position.fa_flight_id}/track`, {
            headers,
          });

          const flightData = {
            ...flightResponse.data,
            ...flightTrackResponse.data,
          };

          // eslint-disable-next-line no-console
          console.log('flightData', position.fa_flight_id);

          allFlights.push(flightData);
        }
      }
    }
    nextUrl = links && links.next ? `${AERO_API_URL}${links.next}` : null;
  }

  res.status(httpStatus.OK).json({ flights: allFlights });
});

const getFlightTrack = catchAsync(async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(`${AERO_API_URL}/flights/${id}/track`, { headers });

    res.status(httpStatus.OK).send(response.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    res.status(httpStatus.NOT_FOUND).send({ error: 'Flight not found' });
  }
});

module.exports = {
  searchFlights,
  getFlightTrack,
  searchFlightsPositions,
  searchFlightsPositionsByTimestamps,
};

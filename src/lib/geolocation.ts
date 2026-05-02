export interface LocationData {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  source: 'gps' | 'ip';
}

export async function getLocationByIP(): Promise<LocationData> {
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,lat,lon');
    const data = await res.json();
    if (data.status === 'success') {
      return {
        city: data.city || 'Unknown',
        state: data.regionName || 'Unknown',
        country: data.country || 'Unknown',
        countryCode: data.countryCode || 'XX',
        lat: data.lat || 0,
        lng: data.lon || 0,
        source: 'ip',
      };
    }
  } catch {}
  return { city: 'Unknown', state: 'Unknown', country: 'Unknown', countryCode: 'XX', lat: 0, lng: 0, source: 'ip' };
}

export function getLocationByGPS(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          const data = await res.json();
          resolve({
            city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
            state: data.address?.state || 'Unknown',
            country: data.address?.country || 'Unknown',
            countryCode: data.address?.country_code?.toUpperCase() || 'XX',
            lat: latitude,
            lng: longitude,
            source: 'gps',
          });
        } catch {
          resolve({ city: 'Unknown', state: 'Unknown', country: 'Unknown', countryCode: 'XX', lat: latitude, lng: longitude, source: 'gps' });
        }
      },
      () => reject(new Error('GPS permission denied')),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
}

export async function detectLocation(): Promise<LocationData> {
  try {
    return await getLocationByGPS();
  } catch {
    return await getLocationByIP();
  }
}

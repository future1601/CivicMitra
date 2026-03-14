import React, { useEffect, useRef } from "react";
import { FeatureCollection, Point } from "geojson";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./mapboxMap.css";
import { Location } from "../../services/api";

const MAPBOX_ACCESS_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const DEFAULT_CENTER: [number, number] = [85.3096, 23.3441];
const DEFAULT_ZOOM = 5;
const SOURCE_ID = "complaint-locations";
const LAYER_ID = "complaint-locations-layer";
const LABEL_LAYER_ID = "complaint-locations-labels";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

type LocationProperties = {
  title: string;
  description: string;
  report_id?: string;
  category?: string;
  priority?: string;
  department?: string;
  status?: string;
  full_description?: string;
  created_at?: string;
  phone_number?: string;
  resolution_days?: number;
};

const buildGeoJson = (
  locations: Location[]
): FeatureCollection<Point, LocationProperties> => ({
  type: "FeatureCollection",
  features: locations.map((loc) => ({
    type: "Feature",
    properties: {
      title: loc.name,
      description: loc.info,
      report_id: loc.report_id,
      category: loc.category,
      priority: loc.priority,
      department: loc.department,
      status: loc.status,
      full_description: loc.description,
      created_at: loc.created_at,
      phone_number: loc.phone_number,
      resolution_days: loc.resolution_days,
    },
    geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
  })),
});

const upsertLocationsLayer = (mapInstance: mapboxgl.Map, locations: Location[]) => {
  const geojson = buildGeoJson(locations);
  const source = mapInstance.getSource(SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(geojson);
    return;
  }

  mapInstance.addSource(SOURCE_ID, {
    type: "geojson",
    data: geojson,
  });

  mapInstance.addLayer({
    id: LAYER_ID,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-radius": [
        "match",
        ["get", "priority"],
        "very_high",
        10,
        "high",
        9,
        "medium",
        8,
        7,
      ],
      "circle-color": [
        "match",
        ["get", "priority"],
        "very_high",
        "#dc2626",
        "high",
        "#f97316",
        "medium",
        "#eab308",
        "#2563eb",
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.9,
    },
  });

  mapInstance.addLayer({
    id: LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "text-field": ["get", "title"],
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-offset": [0, 1.2],
      "text-anchor": "top",
      "text-size": 11,
    },
    paint: {
      "text-color": "#1f2937",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1,
    },
  });
};

const fitMapToLocations = (mapInstance: mapboxgl.Map, locations: Location[]) => {
  if (locations.length === 0) {
    mapInstance.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 0 });
    return;
  }

  if (locations.length === 1) {
    const [location] = locations;
    mapInstance.easeTo({
      center: [location.lng, location.lat],
      zoom: 12,
      duration: 0,
    });
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  locations.forEach((location) => bounds.extend([location.lng, location.lat]));
  mapInstance.fitBounds(bounds, {
    padding: 48,
    maxZoom: 12,
    duration: 0,
  });
};

interface MapProps {
  locations: Location[];
  onMarkerClick?: (location: Location) => void;
}

const MapboxMap: React.FC<MapProps> = ({ locations, onMarkerClick }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const locationsRef = useRef<Location[]>(locations);

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.current = mapInstance;

    mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");

    const handleLayerClick = (event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
      if (!onMarkerClick || !event.features || event.features.length === 0) {
        return;
      }

      const properties = event.features[0].properties as LocationProperties | undefined;
      const clickedLocation = locationsRef.current.find(
        (location) => location.report_id === properties?.report_id
      );

      if (clickedLocation) {
        onMarkerClick(clickedLocation);
      }
    };

    mapInstance.on("load", () => {
      upsertLocationsLayer(mapInstance, locationsRef.current);
      fitMapToLocations(mapInstance, locationsRef.current);

      mapInstance.on("click", LAYER_ID, handleLayerClick);
      mapInstance.on("mouseenter", LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = "pointer";
      });
      mapInstance.on("mouseleave", LAYER_ID, () => {
        mapInstance.getCanvas().style.cursor = "";
      });
    });

    return () => {
      mapInstance.remove();
      map.current = null;
    };
  }, [onMarkerClick]);

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) {
      return;
    }

    const syncMapData = () => {
      upsertLocationsLayer(mapInstance, locations);
      fitMapToLocations(mapInstance, locations);
    };

    if (mapInstance.isStyleLoaded()) {
      syncMapData();
      return;
    }

    mapInstance.once("load", syncMapData);
  }, [locations]);

  return <div ref={mapContainer} className="map-container" />;
};

export default MapboxMap;

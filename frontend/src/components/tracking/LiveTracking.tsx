import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Delivery } from "../../types";
import { supabase } from "../../lib/supabase";
import "leaflet/dist/leaflet.css";

type Props = { delivery: Delivery };

/**
 * Affiche la position du coursier en direct. N'est monté que lorsqu'une livraison
 * existe réellement (voir OrderTracking.tsx) — conformément au cahier des charges :
 * "la carte ne doit apparaître que lorsqu'une livraison existe".
 *
 * Utilise Leaflet + OpenStreetMap (gratuit, aucune clé API requise). Pour passer à
 * Google Maps, fournissez VITE_GOOGLE_MAPS_API_KEY et remplacez ce composant par
 * @react-google-maps/api — l'interface (prop `delivery`) resterait identique.
 */
export default function LiveTracking({ delivery: initial }: Props) {
  const [delivery, setDelivery] = useState<Delivery>(initial);

  useEffect(() => {
    const channel = supabase
      .channel(`delivery-${initial.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deliveries", filter: `id=eq.${initial.id}` },
        (payload) => setDelivery((prev) => ({ ...prev, ...(payload.new as Delivery) }))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.id]);

  const hasPosition = delivery.courier_lat != null && delivery.courier_lng != null;

  if (!hasPosition) {
    return (
      <div className="ac-card ac-card--pad ac-text-center">
        <div style={{ fontSize: 28, marginBottom: 6 }}>📡</div>
        <p className="ac-text-sm">En attente de la position du coursier…</p>
      </div>
    );
  }

  const position: [number, number] = [delivery.courier_lat as number, delivery.courier_lng as number];

  return (
    <div className="ac-card" style={{ overflow: "hidden", height: 260 }}>
      <MapContainer center={position} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          <Popup>Votre coursier est ici 🛵</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

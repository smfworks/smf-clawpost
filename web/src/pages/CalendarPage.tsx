import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { PLATFORM_COLORS } from "@clawpost/shared";
import { api } from "../api.js";

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([]);

  async function load() {
    try {
      const posts = await api.posts.list();
      const evs = posts.flatMap((p: any) =>
        p.variants.map((v: any) => ({
          id: `${p.id}:${v.id}`,
          title: `${v.platform.toUpperCase()} · ${v.body.slice(0, 40)}`,
          start: p.scheduled_for,
          backgroundColor: (PLATFORM_COLORS as any)[v.platform] ?? "#666",
          extendedProps: { postId: p.id, status: p.status },
        }))
      );
      setEvents(evs);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-panel rounded-lg p-4 border border-[#2a3145]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        editable
        eventDrop={async (info) => {
          const postId = (info.event.extendedProps as any).postId;
          await api.posts.update(postId, { scheduled_for: info.event.startStr });
          load();
        }}
        height="auto"
      />
    </div>
  );
}

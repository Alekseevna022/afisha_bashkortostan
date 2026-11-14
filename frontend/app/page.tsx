import EventList from "@/app/components/EventList";

export default function Home() {
  return (
    <div>
      <h1 className="mb-6 font-serif text-4xl font-bold">
        Культурные мероприятия
      </h1>
      <EventList />
    </div>
  );
}

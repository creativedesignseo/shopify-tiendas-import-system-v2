import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function Home() {
  const suggestions = [
    {
      title: "Ride",
      desc: "Go anywhere with Uber. Request a ride, hop in, and go.",
      img: "https://mobile-content.uber.com/launch-experience/top_bar_rides_3d.png",
      href: "#",
    },
    {
      title: "Reserve",
      desc: "Reserve your ride in advance so you can relax on the day of your trip.",
      img: "https://mobile-content.uber.com/uber_reserve/reserve_clock.png",
      href: "#",
    },
    {
      title: "Rental Cars",
      desc: "Your perfect rental car is a few clicks away. Learn more about Uber Rent.",
      img: "https://mobile-content.uber.com/launch-experience/car-rentals.png",
      href: "#",
    },
    {
      title: "Food",
      desc: "Order delivery from local restaurants with Uber Eats.",
      img: "https://d4p17acsd5wyj.cloudfront.net/shortcuts/restaurants.png",
      href: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-20">
      {/* Navbar */}
      <header className="bg-black text-white h-16 flex items-center justify-between px-4 lg:px-16 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-normal tracking-tight">
            Uber
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <Link href="#" className="hover:text-gray-300">
              Ride
            </Link>
            <Link href="#" className="hover:text-gray-300">
              Drive
            </Link>
            <Link href="#" className="hover:text-gray-300">
              Business
            </Link>
            <Link href="#" className="hover:text-gray-300">
              Uber Eats
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="#" className="hidden lg:block hover:text-gray-300">
            EN
          </Link>
          <Link href="#" className="hidden lg:block hover:text-gray-300">
            Help
          </Link>
          <Link href="/dashboard" className="hidden lg:block hover:text-gray-300">
            Log in
          </Link>
          <Button variant="pill" size="sm" className="font-medium bg-white text-black hover:bg-gray-200">
            Sign up
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-[1280px] px-4 lg:px-16 py-10 lg:py-16 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left: Form */}
        <div className="space-y-8 max-w-lg">
          <h1 className="text-4xl lg:text-[56px] font-bold tracking-tight leading-[1.1]">
            Go anywhere with Uber
          </h1>

          <div className="space-y-4">
            <div className="relative">
              <label className="absolute top-3 left-4 flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 bg-black rounded-full" />
                Pickup location
              </label>
              <Input
                placeholder="Enter pickup location"
                className="pt-8 pb-3 bg-[#F3F3F3] text-base border-none rounded-lg placeholder:text-gray-500"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 rounded-full transition-colors">
                <MapPin className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <label className="absolute top-3 left-4 flex items-center gap-2 text-sm font-medium">
                <div className="w-2 h-2 bg-black opacity-30 rounded-sm" />
                Dropoff location
              </label>
              <Input
                placeholder="Enter destination"
                className="pt-8 pb-3 bg-[#F3F3F3] text-base border-none rounded-lg placeholder:text-gray-500"
              />
            </div>
            
            <div className="flex items-center gap-4 py-2">
                 <Button variant="secondary" className="gap-2 px-4 h-10 font-medium text-sm">
                    <Clock className="w-4 h-4" />
                    Pickup now
                    <ChevronDown className="w-4 h-4 ml-1" />
                 </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center pt-2">
            <Button size="lg" className="w-full sm:w-auto text-lg font-bold px-8 h-12 rounded-lg">
              See prices
            </Button>
          </div>
        </div>

        {/* Right: Image */}
        <div className="relative h-[300px] lg:h-[550px] w-full rounded-2xl overflow-hidden bg-[#F3F3F3]">
          <Image
            src="https://cn-geo1.uber.com/image-proc/crop/resizecrop/udam/format=auto/width=1072/height=1072/srcb64=aHR0cHM6Ly90Yi1zdGF0aWMudWJlci5jb20vcHJvZC91ZGFtLWFzc2V0cy9jZTczNjUzMy1iMWE0LTQ3ZjktOTk0OS0zNWEzZGUyNTkyYzk="
            fill
            className="object-cover"
            alt="Uber travel illustration"
            priority
          />
        </div>
      </section>

      {/* Suggestions Grid */}
      <section className="mx-auto max-w-[1280px] px-4 lg:px-16 py-10">
        <h2 className="text-3xl font-bold mb-8 tracking-tight">Suggestions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {suggestions.map((item) => (
            <Card
              key={item.title}
              className="group relative overflow-hidden bg-[#F3F3F3] border-none hover:bg-[#E2E2E2] transition-colors cursor-pointer h-full min-h-[160px] flex flex-col justify-between"
            >
              <div className="p-4 z-10 relative space-y-1">
                <h3 className="text-lg font-medium tracking-tight mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-gray-600 leading-snug line-clamp-2 pr-12">
                  {item.desc}
                </p>
              </div>
              
              <div className="absolute right-2 bottom-2 w-24 h-24">
                  <Image src={item.img} fill className="object-contain" alt={item.title} />
              </div>
               
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 bg-white rounded-full p-1" />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

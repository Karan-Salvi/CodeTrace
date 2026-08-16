import * as React from "react";
import { Link } from "react-router-dom";
import type { ReactElement } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "./navigation-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "../../lib/utils";
import {
  Bot,
  Box,
  Calendar,
  BarChart3,
  Cpu,
  ArrowUpRight,
  Globe,
  LayoutGrid,
  PenTool,
  ScanText,
  Shield,
  Smile,
  Sparkle,
  BookText,
  Briefcase,
  Code,
  Component,
  Code2,
  Network,
  Sparkles,
  MonitorUp,
  AppWindow,
  Layers,
  Monitor, 
  Moon, 
  Sun,
  PlusCircle,
  LogOut,
  Triangle
} from "lucide-react";
import { Button } from "./button"; 
import { useState, useCallback, useEffect } from "react"; 

const cloud: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "AI SDK",
    href: "#",
    icon: <Box strokeWidth={2} />,
    description: "The AI Toolkit for Typescript",
  },
  {
    title: "AI Gateway",
    href: "#",
    icon: <Sparkle strokeWidth={2} />,
    description: "One endpoint, all your models",
  },
  {
    title: "Vercel Agent",
    href: "#",
    icon: <ArrowUpRight strokeWidth={2} />,
    description: "An agent that knows your stack",
  },
];

const core: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "CI/CD",
    href: "#",
    icon: <LayoutGrid strokeWidth={2} />,
    description: "Helping teams ship 6× faster",
  },
  {
    title: "Content Delivery",
    href: "#",
    icon: <Globe strokeWidth={2} />,
    description: "Fast, scalable, and reliable",
  },
  {
    title: "Fluid Compute",
    href: "#",
    icon: <Cpu strokeWidth={2} />,
    description: "Servers, in serverless form",
  },
  {
    title: "Observability",
    href: "#",
    icon: <BarChart3 strokeWidth={2} />,
    description: "Trace every step",
  },
];

const security: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Bot Management",
    href: "#",
    icon: <Bot strokeWidth={2} />,
    description: "Scalable bot protection",
  },
  {
    title: "BotID",
    href: "#",
    icon: <ScanText strokeWidth={2} />,
    description: "Invisible CAPTCHA",
  },
  {
    title: "Platform Security",
    href: "#",
    icon: <Shield strokeWidth={2} />,
    description: "DDOS Protection, Firewall",
  },
  {
    title: "Web Application Firewall",
    href: "#",
    icon: <Calendar strokeWidth={2} />,
    description: "Granular, custom protection",
  },
];

const company: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Customers",
    href: "#",
    icon: <Smile strokeWidth={2} />,
    description: "Trusted by the best teams",
  },
  {
    title: "Blog",
    href: "#",
    icon: <PenTool strokeWidth={2} />,
    description: "The latest posts and changes",
  },
  {
    title: "Changelog",
    href: "#",
    icon: <BookText strokeWidth={2} />,
    description: "See what shipped",
  },
  {
    title: "Press",
    href: "#",
    icon: <Briefcase strokeWidth={2} />,
    description: "Read the latest news",
  },
  {
    title: "Events",
    href: "#",
    icon: <Calendar strokeWidth={2} />,
    description: "Join us at an event",
  },
];

const open: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Next.js",
    href: "#",
    icon: <Code strokeWidth={2} />,
    description: "The native Next.js platform",
  },
  {
    title: "Nuxt",
    href: "#",
    icon: <Component strokeWidth={2} />,
    description: "The progressive web framework",
  },
  {
    title: "Svelte",
    href: "#",
    icon: <Code2 strokeWidth={2} />,
    description: "The web's efficient Ul framework",
  },
  {
    title: "Turborepo",
    href: "#",
    icon: <Network strokeWidth={2} />,
    description: "Speed with Enterprise scale",
  },
];

const tools: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Academy",
    href: "#",
    icon: <Code strokeWidth={2} />,
    description: "Learn the ins and outs of Vercel",
  },
  {
    title: "Marketplace",
    href: "#",
    icon: <Component strokeWidth={2} />,
    description: "Extend and automate workflows",
  },
  {
    title: "Templates",
    href: "#",
    icon: <Code2 strokeWidth={2} />,
    description: "Jumpstart app development",
  },
  {
    title: "Guides",
    href: "#",
    icon: <Network strokeWidth={2} />,
    description: "Find help quickly",
  },
  {
    title: "Partner Finder",
    href: "#",
    icon: <Network strokeWidth={2} />,
    description: "Get help from solution partners",
  },
];

const cases: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Al Apps",
    href: "#",
    icon: <Sparkles strokeWidth={2} />,
    description: "Deploy at the speed of Al",
  },
  {
    title: "Composable Commerce",
    href: "#",
    icon: <Component strokeWidth={2} />,
    description: "Power storefronts that convert",
  },
  {
    title: "Marketing Sites",
    href: "#",
    icon: <MonitorUp strokeWidth={2} />,
    description: "Jumpstart app development",
  },
  {
    title: "Multi-tenant Platforms",
    href: "#",
    icon: <Network strokeWidth={2} />,
    description: "Scale apps with one codebase",
  },
  {
    title: "Web Apps",
    href: "#",
    icon: <AppWindow strokeWidth={2} />,
    description: "Ship features, not infrastructure",
  },
];

const users: {
  title: string;
  icon: ReactElement;
  href: string;
  description: string;
}[] = [
  {
    title: "Platform Engineers",
    href: "#",
    icon: <Code strokeWidth={2} />,
    description: "Automate away repetition",
  },
  {
    title: "Design Engineers",
    href: "#",
    icon: <Layers strokeWidth={2} />,
    description: "Deploy for every idea",
  },
];

export function VercelNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <div
      className={`flex sticky px-4 z-50 top-0 w-full bg-background items-center h-16 justify-between transition-border duration-300 ${
        scrolled ? "border-b border-white/10" : "border-b-0"
      }`}
    >
      {" "}
      <div className="flex items-center justify-between w-full mx-auto max-w-7xl">
        <div className="flex h-14 justify-center items-center">
          <Link to="/" className="flex items-center gap-2">
            <Triangle className="w-6 h-6 fill-current text-white" />
            <span className="font-bold text-lg">CodeTrace</span>
          </Link>
          <NavigationMenu className="ml-8 hidden lg:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground"
                  )}
                >
                  Products
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background">
                  <ul className="grid w-[400px] pt-2 grid-cols-3 md:w-[800px]">
                    <div>
                      <span className="p-4 text-muted-foreground">
                        AI Cloud
                      </span>
                      {cloud.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                    <div>
                      <span className="p-4 text-muted-foreground">
                        Core Platform
                      </span>
                      {core.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                    <div>
                      <span className="p-4 text-muted-foreground">
                        Security
                      </span>
                      {security.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground"
                  )}
                >
                  Resources
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background">
                  <ul className="grid w-[400px] pt-2 grid-cols-3 md:w-[800px]">
                    <div>
                      <span className="p-4 text-muted-foreground">Company</span>
                      {company.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                    <div>
                      <span className="p-4 text-muted-foreground">
                        Open Source
                      </span>
                      {open.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                    <div>
                      <span className="p-4 text-muted-foreground">Tools</span>
                      {tools.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground"
                  )}
                >
                  Solutions
                </NavigationMenuTrigger>
                <NavigationMenuContent className="bg-background">
                  <ul className="grid w-[400px] pt-2 grid-cols-2 md:w-[550px]">
                    <div>
                      <span className="p-4 text-muted-foreground">
                        Use Cases
                      </span>
                      {cases.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                    <div>
                      <span className="p-4 text-muted-foreground">Users</span>
                      {users.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          icon={component.icon}
                          href={component.href}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </div>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground cursor-pointer"
                  )}
                >
                  <Link to="/enterprise">Enterprise</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground cursor-pointer"
                  )}
                >
                  <Link to="/docs">Docs</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink
                  asChild
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-full h-7.5 font-normal text-muted-foreground cursor-pointer"
                  )}
                >
                  <Link to="/pricing">Pricing</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="secondary-sm">
            Contact
          </Button>
          <Link to="/repositories">
            <Button variant="secondary-sm">
              Dashboard
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="border cursor-pointer">
                <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-70 p-3 rounded-xl bg-background" align="end">
              <div className="p-2">
                <h1 className="font-semibold">User</h1>
                <p className="text-sm text-muted-foreground">
                  user@codetrace.app
                </p>
              </div>
              <DropdownMenuGroup>
                <DropdownMenuItem className="py-3 cursor-pointer">Dashboard</DropdownMenuItem>
                <DropdownMenuItem className="py-3 cursor-pointer">
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="py-3 justify-between cursor-pointer">
                  Create Teams <PlusCircle strokeWidth={2} />
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="-mx-3" />
              <DropdownMenuGroup>
                <DropdownMenuItem className="py-3 justify-between cursor-pointer">
                  Theme <ThemeSwitcher />
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="-mx-3" />

              <DropdownMenuItem className="py-3 justify-between cursor-pointer">
                Logout <LogOut strokeWidth={2} />
              </DropdownMenuItem>
              <DropdownMenuSeparator className="-mx-3" />
              <DropdownMenuItem className="pt-3">
                <Button className="w-full">Upgrade to Pro</Button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function ListItem({
  title,
  icon,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & {
  href: string;
  icon: ReactElement;
}) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild className="hover:bg-transparent cursor-pointer">
        <Link to={href}>
          <div className="flex gap-3 items-start rounded-md p-2">
            <div className="border rounded-sm p-2 icon-container">{icon}</div>
            <div className="text-container">
              <div className="text-sm font-medium leading-none">{title}</div>
              <p className="text-muted-foreground line-clamp-2 pt-1 text-xs leading-snug">
                {children}
              </p>
            </div>
          </div>
        </Link>
      </NavigationMenuLink>

      <style>{`
        li:hover .icon-container {
          background-color: var(--foreground);
          color: var(--background);
          transform: scale(1.05);
          transition: all 0.2s ease;
        }

        li:hover .text-container .text-sm {
          color: var(--foreground);
          transition: color 0.2s ease;
        }

        li:hover .text-container p {
          color: var(--foreground);
          transition: color 0.2s ease;
        }
      `}</style>
    </li>
  );
}

const themes = [
  {
    key: "system",
    icon: Monitor,
    label: "System theme",
  },
  {
    key: "light",
    icon: Sun,
    label: "Light theme",
  },
  {
    key: "dark",
    icon: Moon,
    label: "Dark theme",
  },
];

export type ThemeSwitcherProps = {
  className?: string;
};

const ThemeSwitcher = ({ className }: ThemeSwitcherProps) => {
  const [theme, setTheme] = useState("dark");
  const [mounted, setMounted] = useState(false);

  const handleThemeClick = useCallback(
    (themeKey: string) => {
      setTheme(themeKey);
      if (themeKey === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    []
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative isolate flex h-7 rounded-full bg-background p-1 ring-1 ring-border",
        className
      )}
    >
      {themes.map(({ key, icon: Icon, label }) => {
        const isActive = theme === key;

        return (
          <button
            aria-label={label}
            className="relative h-5 w-6 rounded-full cursor-pointer"
            key={key}
            onClick={() => handleThemeClick(key)}
            type="button"
          >
            {isActive && (
              <div className="absolute inset-0 rounded-full bg-secondary" />
            )}
            <Icon
              className={cn(
                "relative z-10 m-auto h-3.5 w-3.5",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

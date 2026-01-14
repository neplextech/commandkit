import * as React from 'react';
import {
  BellIcon,
  PlugIcon,
  SquareTerminal,
  WrenchIcon,
  ScanEye,
} from 'lucide-react';
import { VscGithub } from 'react-icons/vsc';
import { FaDiscord } from 'react-icons/fa';

import { NavMain } from '@/components/nav-main';
import { NavMonitoring } from '@/components/nav-monitoring';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Link } from '@tanstack/react-router';
import { useClient } from '@/context/client-context';

const data = {
  user: {
    name: 'Neplex',
    username: 'neplextech',
    avatar: 'https://github.com/neplextech.png',
  },
  navMain: [
    {
      title: 'Commands',
      url: '/commands',
      icon: SquareTerminal,
      isActive: false,
    },
    {
      title: 'Events',
      url: '/events',
      icon: BellIcon,
      isActive: false,
    },
    {
      title: 'Plugins',
      url: '/plugins',
      icon: PlugIcon,
      isActive: false,
    },
    {
      title: 'Guilds',
      url: '/guilds',
      icon: FaDiscord,
      isActive: false,
    },
    {
      title: 'Feature Flags',
      url: '/feature-flags',
      icon: ScanEye,
      isActive: false,
    },
  ],
  navSecondary: [
    {
      title: 'GitHub',
      url: 'https://github.com/neplextech/commandkit',
      icon: VscGithub,
    },
    {
      title: 'Discord',
      url: 'https://neplextech.com/discord',
      icon: FaDiscord,
    },
  ],
  projects: [
    {
      name: 'Commands',
      url: '#',
      icon: SquareTerminal,
    },
    {
      name: 'Middlewares',
      url: '#',
      icon: WrenchIcon,
    },
    {
      name: 'Events',
      url: '#',
      icon: BellIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const client = useClient<true>();

  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="border-sidebar-primary border text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img src="/logo.webp" alt="Logo" className="size-6" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">CommandKit</span>
                  <span className="truncate text-xs">DevTools</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavMonitoring projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            avatar: client.user.data.displayAvatarURL,
            name: client.user.data.globalName || client.user?.data.username,
            username: client.user.data.username,
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

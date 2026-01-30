import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';

interface TopNavBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TopNavBar({ searchQuery, onSearchChange }: TopNavBarProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/residents', label: 'Residents' },
    { path: '/admissions', label: 'Admissions' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <header className="flex h-16 items-center justify-between border-b border-solid border-[#e7edf3] bg-white px-10 z-20">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary-500">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M24 18.4228L42 11.475V34.3663C42 34.7796 41.7457 35.1504 41.3601 35.2992L24 42V18.4228Z"
                fill="currentColor"
                fillRule="evenodd"
              />
              <path
                clipRule="evenodd"
                d="M24 8.18819L33.4123 11.574L24 15.2071L14.5877 11.574L24 8.18819ZM9 15.8487L21 20.4805V37.6263L9 32.9945V15.8487ZM27 37.6263V20.4805L39 15.8487V32.9945L27 37.6263ZM25.354 2.29885C24.4788 1.98402 23.5212 1.98402 22.646 2.29885L4.98454 8.65208C3.7939 9.08038 3 10.2097 3 11.475V34.3663C3 36.0196 4.01719 37.5026 5.55962 38.098L22.9197 44.7987C23.6149 45.0671 24.3851 45.0671 25.0803 44.7987L42.4404 38.098C43.9828 37.5026 45 36.0196 45 34.3663V11.475C45 10.2097 44.2061 9.08038 43.0155 8.65208L25.354 2.29885Z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">MediBed Pro</h2>
        </div>
        <nav className="flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm h-16 flex items-center ${
                  isActive
                    ? 'font-semibold text-primary-500 border-b-2 border-primary-500'
                    : 'font-medium text-[#4c739a] hover:text-primary-500'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex flex-col min-w-64 h-10">
          <div className="flex w-full items-stretch rounded-lg bg-[#e7edf3] h-full">
            <div className="flex items-center justify-center pl-4 text-[#4c739a]">
              <Icon name="search" size={20} />
            </div>
            <input
              className="w-full border-none bg-transparent focus:ring-0 focus:outline-none text-sm placeholder:text-[#4c739a] px-3"
              placeholder="Search resident or room..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </label>
        <div className="flex gap-2">
          <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#e7edf3] text-[#0d141b] hover:bg-[#dde5ed] transition-colors">
            <Icon name="notifications" size={20} />
          </button>
          <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#e7edf3] text-[#0d141b] hover:bg-[#dde5ed] transition-colors">
            <Icon name="help" size={20} />
          </button>
        </div>
        <div
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary-200"
          title="User Profile"
        />
      </div>
    </header>
  );
}

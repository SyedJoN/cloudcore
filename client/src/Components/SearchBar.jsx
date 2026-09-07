import React from 'react'
import { IconSearch } from './Icons/Icons'
import { XMarkIcon } from '@heroicons/react/24/solid'

const SearchBar = ({searchQuery, onSearchChange, classNames="", handleSearchToggle=null}) => {
  return (
     <div className={`gd-search-wrapper md:ml-12 ${classNames} flex items-center`}>
         <div className={`gd-search flex-1`}>
           <span className="gd-search-icon">
             <IconSearch size={"25"} />
           </span>
           <input
             type="text"
             placeholder="Search in Drive"
             value={searchQuery ?? ""}
             onChange={(e) => onSearchChange?.(e.target.value)}
           />
         </div>
         <div onClick={handleSearchToggle} className="absolute right-4 flex items-center justify-center max-w-none cursor-pointer hover:bg-[var(--btn-bg-medium)] p-2 decoration-0 rounded-full">
      
             <XMarkIcon className='w-5 h-5'/>
       
             </div>
       </div>
  )
}

export default SearchBar
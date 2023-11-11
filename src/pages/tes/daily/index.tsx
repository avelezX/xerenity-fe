import React from 'react'
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'
import TesViever from '@components/Tes/Viewer/tesViwer'

const Home: NextPage = () => (
  
  <AdminLayout>
      <TesViever />
  </AdminLayout>
)

export default Home
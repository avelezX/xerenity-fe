import React from 'react'
import { AdminLayout } from '@layout'
import type { NextPage } from 'next'

import InflationViewer from '@components/canasta/InflationViewer'

const Home: NextPage = () => (
  
  <AdminLayout>
      <InflationViewer />
  </AdminLayout>
)

export default Home

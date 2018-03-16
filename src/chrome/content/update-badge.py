#!/usr/bin/env python

import sys
import dbus
from dbus import Interface
import os
import re

LATTE_NAME = 'org.kde.lattedock'
LATTE_PATH = '/Latte'

class LatteDBus:
	def __init__(self, name=LATTE_NAME, path=LATTE_PATH):
		self.bus = dbus.SessionBus()
		self.obj = self.bus.get_object(name, path)
		self.count = 0 if len(sys.argv) < 2 else int(sys.argv[1])
		## Path and interfaces
		self.name = name
		self.path = path
		
	def update(self):
		if self.count:
			self.obj.updateDockItemBadge('thunderbird', str(self.count))
		else:
			self.obj.updateDockItemBadge('thunderbird', str(0))

class LatteDBus70(LatteDBus):
	def __init__(self):
		LatteDBus.__init__(self, 'org.kde.lattedock', '/Latte');

######
######
######
try:
	LatteDBus70().update();
except BaseException as e:
	print("Couldn't connect to Latte Dock...", e)
